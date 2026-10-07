param([Parameter(Mandatory=$true)][string]$Store,[switch]$Automatic)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::InputEncoding=New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Security
$utf=New-Object Text.UTF8Encoding($false)
function Save-Json($name,$value,$secret=$false){
 $path=Join-Path $Store $name;$bytes=$utf.GetBytes((ConvertTo-Json -InputObject $value -Depth 12 -Compress))
 if($secret){$bytes=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)}
 $tmp=Join-Path $Store ([Guid]::NewGuid().ToString()+'.tmp');$bak=$tmp+'.old'
 try{[IO.File]::WriteAllBytes($tmp,$bytes);if([IO.File]::Exists($path)){[IO.File]::Replace($tmp,$path,$bak)}else{[IO.File]::Move($tmp,$path)}}finally{if([IO.File]::Exists($tmp)){[IO.File]::Delete($tmp)};if([IO.File]::Exists($bak)){[IO.File]::Delete($bak)}}
}
function Load-Json($name,$secret=$false){
 $path=Join-Path $Store $name;if(![IO.File]::Exists($path)){return @()}
 $bytes=[IO.File]::ReadAllBytes($path);if($secret){$bytes=[Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)}
 return @(ConvertFrom-Json -InputObject $utf.GetString($bytes))
}
function Metadata($accounts){return @($accounts|ForEach-Object { @{id=$_.id;label=$_.label;email=$_.email;host=$_.host;port=993} })}
function Check-Root($root){
 $scan=[IO.Path]::GetFullPath($root.path);if(!(Test-Path -LiteralPath $scan -PathType Container)){throw 'Folder tidak ditemukan.'};while($scan){$item=Get-Item -LiteralPath $scan -Force;if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link dan junction tidak diizinkan.'};$parent=[IO.Path]::GetDirectoryName($scan.TrimEnd([char[]]'\/'));if(!$parent -or $parent -eq $scan){break};$scan=$parent}
}
function Check-Path($root,$relative,$mustExist=$true){
 if([string]::IsNullOrWhiteSpace($relative) -or [IO.Path]::IsPathRooted($relative) -or $relative.Contains(':')){throw 'Nama file harus relatif terhadap folder pilihan.'}
 Check-Root $root
 $base=[IO.Path]::GetFullPath($root.path).TrimEnd([char[]]'\/')+[string][IO.Path]::DirectorySeparatorChar;$full=[IO.Path]::GetFullPath((Join-Path $base $relative))
 if(!$full.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw 'File berada di luar folder yang diizinkan.'}
 $scan=$full;while($scan.TrimEnd([char[]]'\/').Length -ge $base.TrimEnd([char[]]'\/').Length){
  if(Test-Path -LiteralPath $scan){$item=Get-Item -LiteralPath $scan -Force;if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link dan junction tidak diizinkan.'}}
  $parent=[IO.Path]::GetDirectoryName($scan.TrimEnd([char[]]'\/'));if(!$parent -or $parent -eq $scan){break};$scan=$parent
 }
 if($mustExist -and ![IO.File]::Exists($full)){throw 'File tidak ditemukan.'};return $full
}
function Imap-Line($stream){
 $b=New-Object Collections.Generic.List[byte];while($true){$v=$stream.ReadByte();if($v -lt 0){throw 'Koneksi email terputus.'};if($v -eq 10){break};if($v -ne 13){$b.Add([byte]$v)};if($b.Count -gt 65536){throw 'Respons email terlalu besar.'}}
 return [Text.Encoding]::ASCII.GetString($b.ToArray())
}
function Imap-Command($s,[string]$command){
 $script:tag++;$tag='D'+$script:tag;$b=$utf.GetBytes($tag+' '+$command+"`r`n");$s.Write($b,0,$b.Length);$s.Flush()
 $lines=New-Object Collections.Generic.List[string];$literals=New-Object Collections.Generic.List[string];$total=0
 while($true){$line=Imap-Line $s;$lines.Add($line);$total+=$line.Length;if($total -gt 300000){throw 'Respons email terlalu besar.'}
  if($line -match '\{([0-9]+)\}$'){$n=[int]$Matches[1];if($n -gt 100000){throw 'Email terlalu besar untuk pratinjau.'};$data=New-Object byte[] $n;$got=0;while($got -lt $n){$read=$s.Read($data,$got,$n-$got);if($read -le 0){throw 'Email belum selesai dibaca.'};$got+=$read};$literals.Add($utf.GetString($data));$total+=$n}
  if($line.StartsWith($tag+' ')){if($line -notmatch ('^'+$tag+' OK\b')){throw 'Server menolak permintaan. Periksa IMAP dan app password akun.'};break}
 }
 return @{lines=@($lines.ToArray());literals=@($literals.ToArray())}
}
function Imap-Quote([string]$v){if($v -match '[\r\n\x00]'){throw 'Kredensial tidak valid.'};return '"'+$v.Replace('\','\\').Replace('"','\"')+'"'}
function Decode-Header([string]$value){
 return [regex]::Replace($value,'=\?([^?]+)\?([bBqQ])\?([^?]*)\?=',{param($m)try{
  $enc=[Text.Encoding]::GetEncoding($m.Groups[1].Value);$v=$m.Groups[3].Value
  if($m.Groups[2].Value -match '[bB]'){$data=[Convert]::FromBase64String($v)}else{$v=$v.Replace('_',' ');$bytes=New-Object Collections.Generic.List[byte];for($i=0;$i -lt $v.Length;$i++){if($v[$i] -eq '=' -and $i+2 -lt $v.Length){$bytes.Add([Convert]::ToByte($v.Substring($i+1,2),16));$i+=2}else{$bytes.Add([byte][char]$v[$i])}};$data=$bytes.ToArray()};return $enc.GetString($data)
 }catch{return $m.Value}})
}
function Header([string]$raw,[string]$name){$raw=$raw -replace "`r?`n[ `t]+",' ';$m=[regex]::Match($raw,'(?im)^'+[regex]::Escape($name)+':\s*(.*)$');return Decode-Header $m.Groups[1].Value.Trim()}
function Mail-Preview([string]$raw,$depth=0){
 if($depth -gt 8){return ''};$parts=([regex]"\r?\n\r?\n").Split($raw,2);if($parts.Count -lt 2){return $raw};$headers=$parts[0];$body=$parts[1];$type=Header $headers 'Content-Type'
 if($type -match 'multipart/' -and $type -match 'boundary\s*=\s*"?([^";\r\n]+)'){$boundary=$Matches[1].Trim();$result=@();foreach($part in ($body -split [regex]::Escape('--'+$boundary))){if($part -match '(?im)^Content-Type:\s*text/plain'){$result+=Mail-Preview $part.TrimStart() ($depth+1)}};if(!$result.Count){foreach($part in ($body -split [regex]::Escape('--'+$boundary))){if($part -match '(?im)^Content-Type:\s*(text/|multipart/)'){$result+=Mail-Preview $part.TrimStart() ($depth+1)}}};return ($result -join "`n").Trim()}
 if($type -and $type -notmatch '^text/'){return '[Lampiran/bagian nonteks tidak dibuka]'}
 $charset='utf-8';if($type -match 'charset\s*=\s*"?([^";\s]+)'){$charset=$Matches[1]};try{$enc=[Text.Encoding]::GetEncoding($charset)}catch{$enc=$utf}
 $transfer=Header $headers 'Content-Transfer-Encoding'
 if($transfer -eq 'base64'){try{$body=$enc.GetString([Convert]::FromBase64String(($body -replace '\s','')))}catch{$body='[Pratinjau base64 terpotong; buka email asli untuk isi lengkap.]'}}
 if($transfer -eq 'quoted-printable'){$body=$body -replace '=\r?\n','';$bytes=New-Object Collections.Generic.List[byte];for($i=0;$i -lt $body.Length;$i++){if($body[$i] -eq '=' -and $i+2 -lt $body.Length -and $body.Substring($i+1,2) -match '^[a-fA-F0-9]{2}$'){$bytes.Add([Convert]::ToByte($body.Substring($i+1,2),16));$i+=2}else{foreach($v in $utf.GetBytes([string]$body[$i])){$bytes.Add($v)}}};$body=$enc.GetString($bytes.ToArray())}
 if($type -match 'text/html'){$body=$body -replace '(?is)<(script|style).*?</\1>','' -replace '(?i)<br\s*/?>|</p>|</div>',"`n" -replace '(?s)<[^>]+>','';$body=[Net.WebUtility]::HtmlDecode($body)}
 return $body.Substring(0,[Math]::Min(12000,$body.Length)).Trim()
}
function Email($account,$action,$uid){
 $tcp=New-Object Net.Sockets.TcpClient;$ssl=$null;$script:tag=0
 try{$connect=$tcp.BeginConnect($account.host,993,$null,$null);if(!$connect.AsyncWaitHandle.WaitOne(15000)){throw 'Koneksi email melewati batas waktu.'};$tcp.EndConnect($connect);$tcp.ReceiveTimeout=20000;$tcp.SendTimeout=20000
  $ssl=New-Object Net.Security.SslStream($tcp.GetStream(),$false);$ssl.ReadTimeout=20000;$ssl.WriteTimeout=20000;$ssl.AuthenticateAsClient($account.host,$null,[Security.Authentication.SslProtocols]::Tls12,$true)
  $greet=Imap-Line $ssl;if($greet -notmatch '^\* OK'){throw 'Server IMAP tidak siap.'}
  $null=Imap-Command $ssl ('LOGIN '+(Imap-Quote $account.email)+' '+(Imap-Quote $account.password));$examine=Imap-Command $ssl 'EXAMINE INBOX'
  if($action -eq 'emailScan'){
   return (Email-ScanStream $ssl $examine $uid)
  }
  if($action -eq 'emailRead'){if([string]$uid -notmatch '^[1-9][0-9]{0,12}$'){throw 'ID email tidak valid.'};$fetch=Imap-Command $ssl ('UID FETCH '+$uid+' (BODY.PEEK[]<0.48000>)');$raw=$fetch.literals -join "`n";return @{uid=$uid;subject=(Header $raw 'Subject');from=(Header $raw 'From');date=(Header $raw 'Date');content=(Mail-Preview $raw);preview=$true}}
  $search=Imap-Command $ssl 'UID SEARCH ALL';$line=@($search.lines|Where-Object {$_ -match '^\* SEARCH'}) -join ' ';$ids=@(($line -replace '^\* SEARCH\s*','').Split(' ')|Where-Object {$_ -match '^\d+$'})
  $unread=Imap-Command $ssl 'UID SEARCH UNSEEN';$unreadLine=@($unread.lines|Where-Object {$_ -match '^\* SEARCH'}) -join ' ';$unreadIds=@(($unreadLine -replace '^\* SEARCH\s*','').Split(' ')|Where-Object {$_ -match '^\d+$'})
  $messages=@();foreach($id in @($ids|Select-Object -Last 20|Sort-Object {[long]$_} -Descending)){$fetch=Imap-Command $ssl ('UID FETCH '+$id+' (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])');$raw=$fetch.literals -join "`n";$messages+=@{uid=$id;subject=(Header $raw 'Subject');from=(Header $raw 'From');date=(Header $raw 'Date');unread=($unreadIds -contains $id)}}
  return @{messages=@($messages);total=$ids.Count;unread=$unreadIds.Count;checkedAt=[DateTime]::UtcNow.ToString('o')}
 }finally{if($ssl){$ssl.Dispose()};$tcp.Close()}
}
. (Join-Path $PSScriptRoot 'mail-automation.ps1')
$mailMutex=$null;$mailLocked=$false
try{
 $request=if($Automatic){[pscustomobject]@{action='mailAutomatic'}}else{ConvertFrom-Json -InputObject ([Console]::In.ReadToEnd())};$action=[string]$request.action
 if($action -like 'mail*'){$mailMutex=New-Object Threading.Mutex($false,('Local\DITASHA-Mail-'+(Mail-Hash $Store).Substring(0,12)));try{$mailLocked=$mailMutex.WaitOne(30000)}catch [Threading.AbandonedMutexException]{$mailLocked=$true};if(!$mailLocked){throw 'Lora sedang memeriksa email. Coba lagi setelah selesai.'}}
 $accounts=@(Load-Json 'mail-accounts.dpapi' $true);$roots=@(Load-Json 'file-roots.json')
 switch($action){
  'status' {$result=@{accounts=@(Metadata $accounts);roots=@($roots)}}
  'emailAdd' {
   if($accounts.Count -ge 20){throw 'Maksimal 20 akun email.'};if([string]$request.email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$' -or $request.email.Length -gt 254 -or [string]$request.host -notmatch '^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$' -or [string]::IsNullOrWhiteSpace($request.password) -or $request.password.Length -gt 512){throw 'Email, server IMAP, atau app password tidak valid.'}
   if($accounts.email -contains $request.email){throw 'Akun ini sudah ditambahkan.'};$label=[string]$request.label;if(!$label){$label=$request.email};if($label.Length -gt 80){throw 'Nama akun maksimal 80 karakter.'}
   $a=@{id=[Guid]::NewGuid().ToString();label=$label;email=[string]$request.email;host=[string]$request.host;password=[string]$request.password;port=993};$null=Email $a 'emailCheck' '';Save-Json 'mail-accounts.dpapi' @($accounts+$a) $true;$result=@{accounts=@(Metadata @($accounts+$a));connected=$true}
  }
  'emailRemove' {if(!($accounts.id -contains $request.id)){throw 'Akun tidak ditemukan.'};$accounts=@($accounts|Where-Object {$_.id -ne $request.id});Save-Json 'mail-accounts.dpapi' $accounts $true;$result=@{accounts=@(Metadata $accounts)}}
  {$_ -in @('emailCheck','emailRead')} {$a=$accounts|Where-Object {$_.id -eq $request.id}|Select-Object -First 1;if(!$a){throw 'Akun tidak ditemukan.'};$result=Email $a $action $request.uid}
  'mailStatus' {$result=Mail-View (Mail-State) $request.page $request.mailPage $(if($request.category){$request.category}else{'Semua'}) $(if($request.review){$request.review}else{'Semua'})}
  'mailPayment' {$state=Mail-State;$result=$state.records|Where-Object {$_.id -eq $request.id -and $_.category -eq 'Keuangan'}|Select-Object -First 1;if(!$result){throw 'Email pembayaran tidak ditemukan.'}}
  'mailSchedule' {$state=Mail-State;Mail-Schedule ($request.enabled -eq $true);$state.enabled=($request.enabled -eq $true);Mail-Save $state;$result=Mail-View $state}
  {$_ -in @('mailScan','mailAutomatic')} {$state=Mail-State;if($action -eq 'mailAutomatic' -and !$state.enabled){$result=@{skipped=$true}}else{$result=Mail-Scan $state $accounts}}
  'mailExport' {$state=Mail-State;$path=Mail-Export $state;Mail-Save $state;$result=@{path=$path}}
  'mailReportOpen' {$path=Join-Path $Store 'Reports\Lora-Achi.xlsx';if(![IO.File]::Exists($path)){throw 'Laporan belum tersedia. Jalankan pemeriksaan email dahulu.'};Start-Process -FilePath $path;$result=@{opened=$true}}
  'mailReview' {
   $state=Mail-State;$record=$state.records|Where-Object {$_.id -eq $request.id -and $_.category -eq 'Keuangan'}|Select-Object -First 1;if(!$record){throw 'Email pembayaran tidak ditemukan.'}
   if($record.review -eq 'recorded'){throw 'Pembayaran sudah dicatat di ledger.'}
   if($request.review -notin @('confirmed','excluded','pending','recorded')){throw 'Status review tidak valid.'}
   if($request.review -eq 'recorded'){if($record.review -ne 'confirmed'){throw 'Konfirmasi pembayaran dahulu.'};if([string]$request.ledgerId -ne ('mail-'+$record.id)){throw 'ID ledger tidak valid.'};$record.ledgerId=$request.ledgerId}
   elseif($request.review -eq 'confirmed'){
    if($request.kind -notin @('income','expense') -or [string]$request.currency -notmatch '^[A-Z]{3}$' -or $null -eq $request.amount -or [decimal]$request.amount -le 0 -or [decimal]$request.amount -gt 1000000000000 -or ([decimal]$request.amount*100)%1 -ne 0){throw 'Jumlah, mata uang atau jenis transaksi tidak valid.'}
    if($request.currency -eq 'IDR' -and ([decimal]$request.amount)%1 -ne 0){throw 'Jumlah IDR harus Rupiah utuh.'}
    $parsed=[DateTime]::MinValue;if(![DateTime]::TryParseExact([string]$request.date,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$parsed)){throw 'Tanggal transaksi tidak valid.'}
    $record.amount=[decimal]$request.amount;$record.currency=[string]$request.currency;$record.kind=$request.kind;$record.transactionDate=$request.date;$record.paymentType=if($request.kind -eq 'income'){'Pemasukan terkonfirmasi'}else{'Pengeluaran terkonfirmasi'};$record.reason='Dikonfirmasi pengguna untuk pencatatan. Tidak ada transfer uang.'
   }
   $record.review=$request.review;Mail-Save $state;try{$null=Mail-Export $state}catch{$state.exportError='Tutup laporan Excel lalu ekspor kembali.'};Mail-Save $state;$result=Mail-View $state
  }
  'folderAdd' {$path=[IO.Path]::GetFullPath([string]$request.path);$item=Get-Item -LiteralPath $path -Force;if(!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Pilih folder biasa, bukan link.'};Check-Root @{path=$path};if($roots.Count -ge 20){throw 'Maksimal 20 folder.'};if($roots.path -notcontains $path){$roots+=@{id=[Guid]::NewGuid().ToString();path=$path};Save-Json 'file-roots.json' $roots};$result=@{roots=@($roots)}}
  'folderRemove' {$roots=@($roots|Where-Object {$_.id -ne $request.id});Save-Json 'file-roots.json' $roots;$result=@{roots=@($roots)}}
  'fileList' {
   $r=$roots|Where-Object {$_.id -eq $request.id}|Select-Object -First 1;if(!$r){throw 'Folder tidak diizinkan.'};Check-Root $r;$queue=New-Object Collections.Generic.Queue[string];$queue.Enqueue($r.path);$files=@();$visited=0;$truncated=$false
   while($queue.Count -gt 0 -and $files.Count -lt 500 -and $visited -lt 1000){$dir=$queue.Dequeue();$visited++;foreach($f in @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction SilentlyContinue)){
    if($f.Attributes -band [IO.FileAttributes]::ReparsePoint){continue};if($f.PSIsContainer){if($queue.Count -lt 1000){$queue.Enqueue($f.FullName)}else{$truncated=$true}}else{$rel=$f.FullName.Substring($r.path.TrimEnd([char[]]'\/').Length).TrimStart([char[]]'\/');$files+=@{path=$rel;size=$f.Length;modified=$f.LastWriteTimeUtc.ToString('o');extension=$f.Extension};if($files.Count -ge 500){$truncated=$true;break}}
   }}
   $result=@{files=@($files);truncated=($truncated -or $queue.Count -gt 0);root=$r.path}
  }
  'fileRead' {
   $r=$roots|Where-Object {$_.id -eq $request.id}|Select-Object -First 1;if(!$r){throw 'Folder tidak diizinkan.'};$p=Check-Path $r $request.path
   if([IO.Path]::GetExtension($p) -notmatch '^\.(txt|md|csv|json|html|css|js|ts|tsx|jsx|lua|xml|ini|cfg|log|yaml|yml|sql|py|cs|svg)$' -or (Get-Item -LiteralPath $p).Length -gt 240000){throw 'Pratinjau hanya untuk file teks/kode UTF-8 hingga 240 KB.'}
   $strict=New-Object Text.UTF8Encoding($false,$true);$content=[IO.File]::ReadAllText($p,$strict);if($content.Contains([string][char]0)){throw 'File ini bukan teks.'};$result=@{path=$request.path;content=$content.Substring(0,[Math]::Min(60000,$content.Length));truncated=($content.Length -gt 60000)}
  }
  'fileMove' {
   $r=$roots|Where-Object {$_.id -eq $request.id}|Select-Object -First 1;if(!$r){throw 'Folder tidak diizinkan.'};$source=Check-Path $r $request.path;$destination=Check-Path $r $request.destination $false
   if([string]$request.destination -match '[<>"|?*\x00-\x1f]' -or $destination -eq $source){throw 'Nama tujuan tidak valid atau sama dengan asal.'};if(Test-Path -LiteralPath $destination){throw 'Tujuan sudah ada. File tidak ditimpa.'};$parent=[IO.Path]::GetDirectoryName($destination)
   $null=[IO.Directory]::CreateDirectory($parent);$null=Check-Path $r $request.destination $false;[IO.File]::Move($source,$destination);$result=@{moved=$true;source=$request.path;destination=$request.destination}
  }
  default {throw 'Operasi tidak dikenal.'}
 }
 [Console]::Out.Write((ConvertTo-Json -InputObject @{ok=$true;data=$result} -Depth 12 -Compress))
}catch{
 $message=$_.Exception.Message;if($message -match 'LOGIN|password|Authenticate|authentication|authenticat|logon'){ $message='Login email gagal. Gunakan app password, periksa alamat dan izin IMAP akun.' }
 if($message.Length -gt 250){$message='Operasi belum berhasil. Periksa izin folder atau konfigurasi email.'}
 [Console]::Out.Write((ConvertTo-Json -InputObject @{ok=$false;error=$message} -Compress))
}

finally{if($mailLocked){$mailMutex.ReleaseMutex()};if($mailMutex){$mailMutex.Dispose()}}
