# Lora/Achi local mail sorting. No message moves, provider calls or money transfers.
function Mail-Hash([string]$text){$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash($utf.GetBytes($text)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Mail-State {
 $saved=@(Load-Json 'mail-sort.dpapi' $true)
 if(!$saved.Count){return [pscustomobject]@{enabled=$false;lastRun='';lastError='';exportError='';nextAccount=0;cursors=@();records=@();accounts=@()}}
 $state=$saved[0];$changed=0
 foreach($record in @($state.records)){
  if($record.classificationVersion -eq 2 -or $record.review -in @('confirmed','recorded','excluded') -or $record.ledgerId){continue}
  $new=Mail-Record @{id='migration';email=$record.account} $record.validity @{subject=$record.subject;from=$record.sender;content=$record.excerpt;date=$record.date;uid=$record.uid;messageId=''}
  foreach($key in @('category','paymentType','kind','amount','currency','dueDate','review','reason')){$record.$key=$new.$key}
  $record | Add-Member -NotePropertyName classificationVersion -NotePropertyValue 2 -Force;$changed++
 }
 if($changed){$state | Add-Member -NotePropertyName reclassified -NotePropertyValue $changed -Force;Mail-Save $state}
 return $state
}
function Mail-PaymentType([string]$text){
 if($text -match '(?i)\b(payment failed|payment declined|payment unsuccessful|pembayaran gagal|transaksi gagal|gagal dibayar|declined transaction)\b'){return 'Pembayaran gagal'}
 if($text -match '(?i)\b(refund (?:received|issued|processed|completed)|pengembalian dana (?:diterima|berhasil)|dana dikembalikan)\b'){return 'Pengembalian'}
 if($text -match '(?i)\b(payment received|pembayaran diterima|dana masuk|transfer masuk|transaksi masuk|gaji diterima|salary paid|cashback received)\b'){return 'Pemasukan'}
 if($text -match '(?i)\b(you paid|you sent|payment successful|payment completed|successfully paid|pembayaran berhasil|transaksi berhasil|transfer berhasil|bukti pembayaran|bukti transfer|payment receipt|receipt for|kwitansi|telah dibayar|sudah dibayar|lunas)\b'){return 'Bukti pembayaran'}
 if($text -match '(?i)\b(unpaid|not paid|payment due|amount due|belum dibayar|jatuh tempo|your invoice|invoice (?:number|no|#|\d)|tagihan|faktur)\b'){return 'Tagihan'}
 if($text -match '(?i)\b(receipt|refund|salary|gaji)\b'){return 'Perlu ditinjau'}
 return ''
}
function Mail-Category([string]$subject,[string]$sender,[string]$body){
 $intro=([string]$body).Substring(0,[Math]::Min(1600,([string]$body).Length))
 if($subject -match '(?i)(verification code|kode verifikasi|one.time password|password reset|reset password|security alert|login baru|new sign.in|\botp\b|tetap log.?in|perangkat tepercaya|trusted device|verify your|verifikasi akun)'){return 'Keamanan'}
 $direct=Mail-PaymentType $subject
 if($direct -and $direct -ne 'Perlu ditinjau'){return 'Keuangan'}
 if($subject -match '(?i)(discount|diskon|\bpromo\b|penawaran|\boffer\b|voucher|newsletter|\bsale\b|free months|months (?:of|for) free|gratis|try premium|set the mood|mulai bisnis|start your business|cashback|upgrade now)'){return 'Promosi'}
 if($subject -match '(?i)(total pengeluaranmu|monthly summary|monthly statement|bank statement|account statement|ringkasan (?:akun|saldo|pengeluaran)|laporan (?:bulanan|rekening)|mutasi rekening)'){return 'Laporan keuangan'}
 if($subject -match '(?i)(storage.*full|penyimpanan.*penuh|aktifkan rekening|activate your account|account activation|konfirmasi alamat|verify.*email|refund policy|terms.*update)'){return 'Layanan akun'}
 if($intro -match '(?i)(verification code|kode verifikasi|one.time password|reset password|\botp\b)'){return 'Keamanan'}
 $bodyType=Mail-PaymentType $intro
 if($bodyType -and $bodyType -ne 'Perlu ditinjau' -and ($intro -notmatch '(?i)(get.*free months|coba.*gratis|penawaran khusus|limited.time offer)' -or $direct)){return 'Keuangan'}
 if($subject -match '(?i)(payment|pembayaran|billing|invoice|transfer|transaksi|receipt|refund|salary|gaji)'){return 'Keuangan'}
 if($subject -match '(?i)(shipped|shipping|delivery|pesanan|pengiriman|resi|paket|order confirmation)'){return 'Pesanan'}
 if($subject -match '(?i)(meeting|project|deadline|rapat|proyek|interview|lamaran|pekerjaan|client|klien|contract|kontrak)'){return 'Pekerjaan'}
 if($sender -match '(?i)(facebook|instagram|tiktok|linkedin|discord|twitter)' -or $subject -match '(?i)(followed|mentioned|commented|menyukai|komentar|pengikut)'){return 'Sosial'}
 if($subject -match '(?i)(birthday|ulang tahun|family|keluarga|invitation|undangan)'){return 'Pribadi'}
 return 'Lainnya'
}
function Mail-Finance([string]$text,[string]$subject=''){
 $status=Mail-PaymentType $subject;if(!$status){$status=Mail-PaymentType $text};if(!$status){$status='Perlu ditinjau'}
 if($status -eq 'Perlu ditinjau' -and $text -match '(?i)\b(refund|pengembalian dana)\b'){$status='Pengembalian'}
 $kind=if($status -in @('Pemasukan','Pengembalian')){'income'}else{'expense'}
 $matches=[regex]::Matches($text,'(?i)(?:\b(Rp|IDR|USD|EUR|GBP)\s*([0-9][0-9.,]*[0-9]|[0-9])|([$€£])\s*([0-9][0-9.,]*[0-9]|[0-9]))')
 $values=@();foreach($m in $matches){$currency=$m.Groups[1].Value.ToUpperInvariant();$raw=$m.Groups[2].Value;if(!$currency){$currency=@{'$'='USD';'€'='EUR';'£'='GBP'}[$m.Groups[3].Value];$raw=$m.Groups[4].Value};if($currency -eq 'RP'){$currency='IDR'}
  $number=$null;if($currency -eq 'IDR'){
   if($raw -match '^\d{1,3}(\.\d{3})+(,00)?$' -or $raw -match '^\d+(,00)?$'){$number=[decimal](($raw -replace ',00$','') -replace '\.','')}
   elseif($raw -match '^\d{1,3}(,\d{3})+(\.00)?$'){$number=[decimal](($raw -replace '\.00$','') -replace ',','')}
  }elseif($raw -match '^\d+(\.\d{1,2})?$' -or $raw -match '^\d{1,3}(,\d{3})+(\.\d{1,2})?$'){$number=[decimal]::Parse($raw.Replace(',',''),[Globalization.CultureInfo]::InvariantCulture)}
  if($null -ne $number -and $number -gt 0 -and $number -le 1000000000000){$values+=@{currency=$currency;amount=$number}}
 }
 $unique=@($values|Group-Object { $_.currency+':'+$_.amount }|ForEach-Object {$_.Group[0]})
 $currency='';$amount=$null;$reason='Jumlah tidak ditemukan. Isi setelah memeriksa email.'
 if($unique.Count -eq 1){$currency=$unique[0].currency;$amount=$unique[0].amount;$reason='Satu jumlah ditemukan; tetap periksa bukti dan status pembayaran.'}
 elseif($unique.Count -gt 1){$reason='Ada beberapa jumlah/mata uang. Pilih jumlah transaksi yang benar.'}
 $due='';$m=[regex]::Match($text,'(?i)(?:due date|jatuh tempo)\s*[:\-]?\s*(20\d{2}-\d{2}-\d{2})');if($m.Success){$due=$m.Groups[1].Value}
 return @{paymentType=$status;kind=$kind;amount=$amount;currency=$currency;dueDate=$due;review='pending';reason=$reason}
}
function Mail-Record($account,$validity,$message){
 $key=if($message.messageId){'message:'+([string]$message.messageId).Trim().ToLowerInvariant()}else{'imap:'+$account.id+':'+$validity+':'+$message.uid}
 $category=Mail-Category $message.subject $message.from $message.content
 $record=[ordered]@{id=(Mail-Hash $key);account=$account.email;uid=$message.uid;validity=$validity;subject=([string]$message.subject).Substring(0,[Math]::Min(500,([string]$message.subject).Length));sender=([string]$message.from).Substring(0,[Math]::Min(500,([string]$message.from).Length));date=([string]$message.date).Substring(0,[Math]::Min(120,([string]$message.date).Length));transactionDate='';category=$category;excerpt=([string]$message.content).Substring(0,[Math]::Min(2500,([string]$message.content).Length));collectedAt=[DateTime]::UtcNow.ToString('o');paymentType='';kind='';amount=$null;currency='';dueDate='';review='';reason='';ledgerId='';classificationVersion=2}
 if($category -eq 'Keuangan'){$finance=Mail-Finance ($message.subject+"`n"+$message.content) $message.subject;foreach($name in $finance.Keys){$record[$name]=$finance[$name]}}
 return [pscustomobject]$record
}
function Mail-TaskName {return 'DITASHA-Lora-'+(Mail-Hash ([IO.Path]::GetFullPath($Store).ToLowerInvariant())).Substring(0,12)}
function Mail-TaskService {$service=New-Object -ComObject 'Schedule.Service';$service.Connect();return $service}
function Mail-TaskInfo {
 try{$task=(Mail-TaskService).GetFolder('\').GetTask((Mail-TaskName));return @{registered=$true;nextRun=$task.NextRunTime.ToString('o');lastResult=$task.LastTaskResult}}catch{return @{registered=$false;nextRun='';lastResult=$null}}
}
function Mail-Schedule([bool]$enable){
 $service=Mail-TaskService;$folder=$service.GetFolder('\');$name=Mail-TaskName
 if(!$enable){try{$null=$folder.GetTask($name)}catch{return};$folder.DeleteTask($name,0);return}
 $task=$service.NewTask(0);$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
 $task.RegistrationInfo.Description='DITASHA Lora checks connected inboxes and sends local payment records to Achi every 20 minutes.'
 $task.Principal.UserId=$user;$task.Principal.LogonType=3;$task.Principal.RunLevel=0
 $task.Settings.Enabled=$true;$task.Settings.StartWhenAvailable=$true;$task.Settings.DisallowStartIfOnBatteries=$false;$task.Settings.StopIfGoingOnBatteries=$false;$task.Settings.MultipleInstances=2;$task.Settings.ExecutionTimeLimit='PT3M'
 $trigger=$task.Triggers.Create(1);$trigger.StartBoundary=[DateTime]::Now.AddMinutes(20).ToString('yyyy-MM-ddTHH:mm:ss');$trigger.Repetition.Interval='PT20M';$trigger.Enabled=$true
 $action=$task.Actions.Create(0);$action.Path=Join-Path ([Environment]::GetFolderPath('System')) 'WindowsPowerShell\v1.0\powershell.exe'
 $action.Arguments='-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $Store 'assistant-tools.ps1')+'" -Store "'+$Store+'" -Automatic'
 $null=$folder.RegisterTaskDefinition($name,$task,6,$user,$null,3)
}
function Mail-View($state,$page=0,$mailPage=0,$category='Semua',$review='Semua'){
 $page=[Math]::Max(0,[Math]::Min(100,[int]$page));$mailPage=[Math]::Max(0,[Math]::Min(100,[int]$mailPage))
 $all=@($state.records);$counts=@{};foreach($record in $all){if(!$counts.ContainsKey($record.category)){$counts[$record.category]=0};$counts[$record.category]++}
  $mailRows=@($all|Where-Object {$category -eq 'Semua' -or $_.category -eq $category}|Sort-Object collectedAt -Descending);$paymentRows=@($all|Where-Object {$_.category -eq 'Keuangan' -and ($review -eq 'Semua' -or $_.review -eq $review)}|Sort-Object collectedAt -Descending)
 return @{reclassified=$state.reclassified;paymentTotal=$paymentRows.Count;mailTotal=$mailRows.Count;enabled=$state.enabled;lastRun=$state.lastRun;lastError=$state.lastError;exportError=$state.exportError;accounts=@($state.accounts);total=$all.Count;counts=$counts;messages=@($mailRows|Select-Object -Skip ($mailPage*100) -First 100|Select-Object id,date,account,subject,sender,category);payments=@($paymentRows|Select-Object -Skip ($page*200) -First 200);pending=@($all|Where-Object {$_.review -eq 'pending'}).Count;reportPath=(Join-Path $Store 'Reports\Lora-Achi.xlsx');schedule=(Mail-TaskInfo)}
}
function Mail-FinanceContext($state){
 $payments=@($state.records|Where-Object {$_.category -eq 'Keuangan' -and $_.review -ne 'excluded'})
 $entries=@($payments|Sort-Object collectedAt -Descending|Select-Object -First 30 id,account,date,transactionDate,subject,category,paymentType,kind,amount,currency,review,reason,excerpt)
 $statements=@($state.records|Where-Object {$_.category -eq 'Laporan keuangan'}|Sort-Object collectedAt -Descending|Select-Object -First 5 subject,date,account,excerpt)
 foreach($entry in (@($entries)+@($statements))){$entry.excerpt=([string]$entry.excerpt).Substring(0,[Math]::Min(600,([string]$entry.excerpt).Length))}
 return @{reclassified=$state.reclassified;lastRun=$state.lastRun;lastError=$state.lastError;total=$payments.Count;pending=@($payments|Where-Object {$_.review -eq 'pending'}).Count;recorded=@($payments|Where-Object {$_.review -eq 'recorded'}).Count;payments=$entries;partial=($payments.Count -gt 30);statements=$statements;scope='Saved sorted email archive, all dates; separate from the recorded ledger. Classification rules may normalize old unreviewed records. No fresh inbox scan or ledger write performed.'}
}
function Mail-Cell($value,[string]$reference,[bool]$numeric=$false,[int]$style=1){
 if($null -eq $value){return '<c r="'+$reference+'"/>'}
 if($numeric){return '<c r="'+$reference+'" s="'+$style+'"><v>'+([Convert]::ToString($value,[Globalization.CultureInfo]::InvariantCulture))+'</v></c>'}
 # inlineStr never interprets email text as formulas or hyperlinks.
 $text=([string]$value) -replace '[\x00-\x08\x0b\x0c\x0e-\x1f]','';return '<c r="'+$reference+'" t="inlineStr"><is><t xml:space="preserve">'+[Security.SecurityElement]::Escape($text)+'</t></is></c>'
}
function Mail-Export($state){
 Add-Type -AssemblyName System.IO.Compression
 $folder=Join-Path $Store 'Reports';$null=[IO.Directory]::CreateDirectory($folder);$path=Join-Path $folder 'Lora-Achi.xlsx';$tmp=Join-Path $folder ([Guid]::NewGuid().ToString()+'.tmp');$bak=$tmp+'.old'
 $stream=$null;$zip=$null
 try{
  $stream=[IO.File]::Open($tmp,[IO.FileMode]::CreateNew);$zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Create,$false)
  function Zip-Text([string]$name,[string]$content){$entry=$zip.CreateEntry($name);$writer=New-Object IO.StreamWriter($entry.Open(),$utf);try{$writer.Write($content)}finally{$writer.Dispose()}}
  Zip-Text '[Content_Types].xml' '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
  Zip-Text '_rels/.rels' '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
  Zip-Text 'xl/workbook.xml' '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pembayaran Achi" sheetId="1" r:id="rId1"/><sheet name="Email Lora" sheetId="2" r:id="rId2"/></sheets></workbook>'
  Zip-Text 'xl/_rels/workbook.xml.rels' '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
  Zip-Text 'xl/styles.xml' '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf xfId="0"/><xf xfId="0" numFmtId="4" applyNumberFormat="1"/><xf xfId="0" numFmtId="14" applyNumberFormat="1"/></cellXfs></styleSheet>'
  $specs=@(@{headers=@('Tanggal email','Akun','Pengirim','Judul','Jenis pembayaran','Mata uang','Jumlah','Jatuh tempo','Review Achi','Catatan','ID sumber','ID ledger','Tanggal transaksi');keys=@('date','account','sender','subject','paymentType','currency','amount','dueDate','review','reason','id','ledgerId','transactionDate');rows=@($state.records|Where-Object {$_.category -eq 'Keuangan'})},@{headers=@('Tanggal email','Akun','Pengirim','Judul','Kategori','ID sumber');keys=@('date','account','sender','subject','category','id');rows=@($state.records)})
  for($sheet=0;$sheet -lt 2;$sheet++){$spec=$specs[$sheet];$xml=New-Object Text.StringBuilder;$null=$xml.Append('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="3" width="28" customWidth="1"/><col min="4" max="4" width="55" customWidth="1"/><col min="5" max="13" width="24" customWidth="1"/></cols><sheetData><row r="1">')
   for($c=0;$c -lt $spec.headers.Count;$c++){$null=$xml.Append((Mail-Cell $spec.headers[$c] (([string][char](65+$c))+'1')))};$null=$xml.Append('</row>');$row=2
   foreach($record in $spec.rows){$null=$xml.Append('<row r="'+$row+'">');for($c=0;$c -lt $spec.keys.Count;$c++){$key=$spec.keys[$c];$value=$record.$key;$numeric=($key -eq 'amount');$style=1;if($key -eq 'transactionDate' -and $value){$value=([DateTime]::ParseExact($value,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)).ToOADate();$numeric=$true;$style=2};$null=$xml.Append((Mail-Cell $value (([string][char](65+$c))+$row) $numeric $style))};$null=$xml.Append('</row>');$row++}
   $last=[string][char](64+$spec.headers.Count);$null=$xml.Append('</sheetData><autoFilter ref="A1:'+$last+($row-1)+'"/></worksheet>');Zip-Text ('xl/worksheets/sheet'+($sheet+1)+'.xml') $xml.ToString()
  }
  $zip.Dispose();$zip=$null;$stream=$null
  if([IO.File]::Exists($path)){[IO.File]::Replace($tmp,$path,$bak)}else{[IO.File]::Move($tmp,$path)}
  $state.exportError='';return $path
 }finally{if($zip){$zip.Dispose()};if($stream){$stream.Dispose()};if([IO.File]::Exists($tmp)){[IO.File]::Delete($tmp)};if([IO.File]::Exists($bak)){[IO.File]::Delete($bak)}}
}
function Mail-Save($state){Save-Json 'mail-sort.dpapi' $state $true}
function Mail-Scan($state,$accounts){
 $watch=[Diagnostics.Stopwatch]::StartNew();$results=@();$known=@{};foreach($record in $state.records){$known[$record.id]=$true}
 if(!$state.PSObject.Properties['nextAccount']){$state|Add-Member NoteProperty nextAccount 0};$ordered=@();for($i=0;$i -lt $accounts.Count;$i++){$ordered+=$accounts[([int]$state.nextAccount+$i)%$accounts.Count]}
 foreach($account in $ordered){if($watch.Elapsed.TotalSeconds -gt 70){$results+=@{account=$account.email;error='Dilanjutkan pada pemeriksaan berikutnya.';remaining=$null};continue}
  $state.nextAccount=(([array]::IndexOf($accounts,$account)+1)%$accounts.Count)
  try{
   $cursor=@($state.cursors|Where-Object {$_.accountId -eq $account.id}|Select-Object -First 1);$requestCursor=if($cursor.Count){$cursor[0]}else{@{lastUid='0';validity=''}}
   $batch=Email $account 'emailScan' $requestCursor
   foreach($message in $batch.messages){if(@($state.records).Count -ge 10000){throw 'Arsip mencapai 10.000 email. Pemeriksaan berhenti; ekspor laporan dan hubungi dukungan sebelum melanjutkan.'};$record=Mail-Record $account $batch.validity $message;if(!$known.ContainsKey($record.id)){$state.records=@($state.records)+$record;$known[$record.id]=$true}}
   $state.cursors=@($state.cursors|Where-Object {$_.accountId -ne $account.id})+[pscustomobject]@{accountId=$account.id;lastUid=$batch.lastUid;validity=$batch.validity;backfillUid=$batch.backfillUid;backfillUntil=$batch.backfillUntil}
   $results+=@{account=$account.email;error='';remaining=$batch.remaining;olderPending=$batch.olderPending;processed=@($batch.messages).Count};$state.accounts=$results;Mail-Save $state
  }catch{$results+=@{account=$account.email;error=$_.Exception.Message;remaining=$null}}
 }
 $state.accounts=$results;$state.lastRun=[DateTime]::UtcNow.ToString('o');$state.lastError=(@($results|Where-Object {$_.error}|ForEach-Object {$_.account+': '+$_.error}) -join "`n")
 try{$null=Mail-Export $state}catch{$state.exportError='Laporan Excel belum diperbarui. Tutup file Excel lalu coba lagi. Catatan email tetap tersimpan.'}
 Mail-Save $state;return (Mail-View $state)
}

function Email-ScanStream($ssl,$examine,$uid){
 $validity='';foreach($line in $examine.lines){if($line -match '\[UIDVALIDITY ([0-9]+)\]'){$validity=$Matches[1]}};if(!$validity){throw 'Server tidak menyediakan UIDVALIDITY.'}
 $fresh=($uid.validity -ne $validity);$last=0;$backfillUid=0;$backfillUntil=0
 if(!$fresh){if([string]$uid.lastUid -match '^\d{1,13}$'){$last=[long]$uid.lastUid};$backfillUid=[long]$uid.backfillUid;$backfillUntil=[long]$uid.backfillUntil}
 $search=Imap-Command $ssl ('UID SEARCH UID '+($last+1)+':*');$ids=@(($search.lines|Where-Object {$_ -match '^\* SEARCH'}) -replace '^\* SEARCH\s*','' -split ' '|Where-Object {$_ -match '^\d+$' -and [long]$_ -gt $last}|Sort-Object {[long]$_})
 $backfill=$false;$chosen=@($ids|Select-Object -First 20)
 if($fresh){$chosen=@($ids|Select-Object -Last 20);if($chosen.Count -and $ids.Count -gt 20){$backfillUntil=[long]$ids[$ids.Count-21]}}
 elseif(!$ids.Count -and $backfillUntil -gt $backfillUid){
  $backfill=$true;$search=Imap-Command $ssl ('UID SEARCH UID '+($backfillUid+1)+':'+$backfillUntil);$ids=@(($search.lines|Where-Object {$_ -match '^\* SEARCH'}) -replace '^\* SEARCH\s*','' -split ' '|Where-Object {$_ -match '^\d+$' -and [long]$_ -gt $backfillUid -and [long]$_ -le $backfillUntil}|Sort-Object {[long]$_});$chosen=@($ids|Select-Object -First 20)
  if(!$chosen.Count){$backfillUid=$backfillUntil}
 }
 $messages=@();$batchWatch=[Diagnostics.Stopwatch]::StartNew();foreach($id in $chosen){if($batchWatch.Elapsed.TotalSeconds -gt 45){break};$fetch=Imap-Command $ssl ('UID FETCH '+$id+' (UID BODY.PEEK[]<0.48000>)');if($fetch.literals.Count){$raw=$fetch.literals -join "`n";$header=([regex]"\r?\n\r?\n").Split($raw,2)[0];$messages+=@{uid=$id;messageId=(Header $header 'Message-ID');subject=(Header $header 'Subject');from=(Header $header 'From');date=(Header $header 'Date');content=(Mail-Preview $raw)}};if($backfill){$backfillUid=[long]$id}else{$last=[long]$id}}
 $pending=@($ids|Where-Object {[long]$_ -gt $(if($backfill){$backfillUid}else{$last})}).Count
 return @{validity=$validity;lastUid=[string]$last;backfillUid=[string]$backfillUid;backfillUntil=[string]$backfillUntil;messages=@($messages);remaining=$pending;olderPending=($backfillUntil -gt $backfillUid)}
}
