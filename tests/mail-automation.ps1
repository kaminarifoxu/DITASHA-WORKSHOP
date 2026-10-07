param([string]$Source,[switch]$TestSchedule)
$ErrorActionPreference='Stop'
$sourcePath=(Resolve-Path $Source).Path
& (Join-Path $PSScriptRoot 'mail-parser.ps1') -Source $sourcePath
$sourceText=[IO.File]::ReadAllText($sourcePath);$start=$sourceText.IndexOf('$ErrorActionPreference');$cut=$sourceText.IndexOf('. (Join-Path $PSScriptRoot')
Invoke-Expression $sourceText.Substring($start,$cut-$start)
. (Join-Path ([IO.Path]::GetDirectoryName($sourcePath)) 'mail-automation.ps1')
function Assert($value,$message){if(!$value){throw $message}}
Assert ((Mail-Category 'Payment receipt' 'bank@example.com' 'Rp 125.000') -eq 'Keuangan') 'Receipt category'
Assert ((Mail-Category 'Diskon Rp 100.000' 'shop@example.com' 'payment promo') -eq 'Promosi') 'Promotion is not a payment'
Assert ((Mail-Category 'OTP bank' 'bank@example.com' 'kode verifikasi Rp 100.000') -eq 'Keamanan') 'OTP is not a payment'
foreach($sample in @(@('Rapat proyek','Pekerjaan'),@('Resi pengiriman','Pesanan'),@('Instagram mentioned you','Sosial'),@('Undangan keluarga','Pribadi'),@('Hello','Lainnya'))){Assert ((Mail-Category $sample[0] 'sender' '') -eq $sample[1]) ('Category '+$sample[1])}
$p=Mail-Finance 'Payment successful. Total Rp 125.000,00';Assert ($p.amount -eq 125000 -and $p.currency -eq 'IDR' -and $p.review -eq 'pending') 'IDR receipt requires review'
$p=Mail-Finance 'Invoice total Rp 125.000,00. Amount due Rp 125.000,00';Assert ($p.amount -eq 125000 -and $p.paymentType -eq 'Tagihan') 'Repeated total and unpaid bill'
$p=Mail-Finance 'Not paid. Invoice USD 19.95';Assert ($p.amount -eq 19.95 -and $p.currency -eq 'USD' -and $p.paymentType -eq 'Tagihan') 'Not paid must never be a receipt'
$p=Mail-Finance 'Receipt subtotal Rp 100.000 tax Rp 11.000 total Rp 111.000';Assert ($null -eq $p.amount) 'Multiple amounts are ambiguous'
$p=Mail-Finance 'Payment Rp 1,50';Assert ($null -eq $p.amount) 'Non-integral/ambiguous IDR amount left blank'
$p=Mail-Finance 'Refund USD 9.50';Assert ($p.kind -eq 'income' -and $p.paymentType -eq 'Pengembalian') 'Refund is separate from spending'
# Realistic subject regressions: advertisements and account notices are not payments.
foreach($sample in @(@('Set the mood with 2 free months of Premium','Then USD 12.99 per month. Subscription and payment terms apply.','Promosi'),@('Penyimpanan iCloud Anda penuh','Upgrade Rp 15.000 per month','Layanan akun'),@('Tetap log in pada perangkat terpercaya ini','PayPal balance USD 5','Keamanan'),@('Silakan aktifkan rekening Anda','Saldo Rp 100.000','Layanan akun'),@('Mulai bisnis Anda dengan PayPal','Accept payments USD 5','Promosi'),@('Ini total pengeluaranmu di Januari','Total pengeluaran Rp 21.000','Laporan keuangan'),@('Info Transaksi Masuk ke blu Kamu','Dana masuk Rp 25.000','Keuangan'),@('You paid to Developed Methods LLC for invoice 4323','Amount USD 5.00. Future invoices are due next month.','Keuangan'),@('Shop0209','You paid USD 5.00 to Shop0209. Transaction ID 123','Keuangan'))){Assert ((Mail-Category $sample[0] 'service@example.test' $sample[1]) -eq $sample[2]) ('Purpose-aware category: '+$sample[0])}
$p=Mail-Finance 'Amount USD 5.00. Future invoice amount due next month.' 'You paid to Developed Methods LLC for invoice 4323';Assert ($p.paymentType -eq 'Bukti pembayaran') 'Explicit paid subject beats invoice footer'
$p=Mail-Finance 'Subscription USD 5.00' 'Discord payment failed';Assert ($p.paymentType -eq 'Pembayaran gagal') 'Failure is never a completed receipt'
$p=Mail-Finance 'Rp 25.000' 'Info Transaksi Masuk ke blu Kamu';Assert ($p.paymentType -eq 'Pemasukan' -and $p.kind -eq 'income') 'Bank incoming transaction is income'
$a=@{id='first';email='one@example.test'};$b=@{id='second';email='two@example.test'};$message=@{uid='1';messageId='<same@example.test>';subject='Receipt';from='bank@example.test';date='Wed, 07 Oct 2026 10:00:00 +0700';content='Payment successful Rp 125.000'}
$one=Mail-Record $a '100' $message;$two=Mail-Record $b '200' $message;Assert ($one.id -eq $two.id) 'Message-ID dedupes copied mail across accounts'
$message.messageId='';$one=Mail-Record $a '100' $message;$two=Mail-Record $a '200' $message;Assert ($one.id -ne $two.id) 'UIDVALIDITY reset does not collide with old UIDs'
# IMAP wildcard search can return the last existing UID even with no new mail.
$script:tag=0;$stream=[ImapTestStream]::new($utf.GetBytes("* SEARCH 8`r`nD1 OK search`r`n"));$batch=Email-ScanStream $stream @{lines=@('* OK [UIDVALIDITY 42] UIDs')} @{validity='42';lastUid='8'}
Assert (@($batch.messages).Count -eq 0 -and $batch.lastUid -eq '8' -and $batch.remaining -eq 0) 'Ignore IMAP star result below cursor'
$raw="Message-ID: <new@example.test>`r`nSubject: Receipt`r`nFrom: Bank`r`nDate: 2026-10-07`r`nContent-Type: text/plain`r`n`r`nPayment successful Rp 125.000";$script:tag=0
$response="* SEARCH 1`r`nD1 OK search`r`n* 1 FETCH (BODY[] {$($utf.GetByteCount($raw))}`r`n"+$raw+")`r`nD2 OK fetched`r`n"
$stream=[ImapTestStream]::new($utf.GetBytes($response));$batch=Email-ScanStream $stream @{lines=@('* OK [UIDVALIDITY 43] UIDs')} @{validity='42';lastUid='999'}
Assert ($batch.validity -eq '43' -and $batch.lastUid -eq '1' -and @($batch.messages).Count -eq 1) 'New UIDVALIDITY restarts scan'
Assert ($batch.messages[0].messageId -eq '<new@example.test>') 'Source message ID retained'
Assert ($utf.GetString($stream.sent.ToArray()).Contains('BODY.PEEK[]')) 'Automation preserves unread status'
$script:tag=0;$ids=(1..21) -join ' ';$response="* SEARCH $ids`r`nD1 OK search`r`n";for($i=1;$i -le 20;$i++){$response+="D$($i+1) OK deleted message`r`n"}
$stream=[ImapTestStream]::new($utf.GetBytes($response));$batch=Email-ScanStream $stream @{lines=@('* OK [UIDVALIDITY 43] UIDs')} @{validity='43';lastUid='0'}
Assert ($batch.lastUid -eq '20' -and $batch.remaining -eq 1) 'Batch preserves progress and pending count'
# A first scan starts with recent mail; old mail then resumes without blocking new arrivals.
$script:tag=0;$ids=(1..21) -join ' ';$response="* SEARCH $ids`r`nD1 OK search`r`n";for($i=1;$i -le 20;$i++){$response+="D$($i+1) OK deleted message`r`n"}
$stream=[ImapTestStream]::new($utf.GetBytes($response));$batch=Email-ScanStream $stream @{lines=@('* OK [UIDVALIDITY 43] UIDs')} @{validity='';lastUid='0'}
Assert ($batch.lastUid -eq '21' -and $batch.backfillUntil -eq '1' -and $batch.olderPending) 'Fresh scan prioritizes recent mail and retains old backlog'
Assert ($utf.GetString($stream.sent.ToArray()).Contains('UID FETCH 2 ')) 'Recent batch starts after retained backlog'
$script:tag=0;$response="* SEARCH 21`r`nD1 OK search`r`n* SEARCH 1`r`nD2 OK search`r`nD3 OK deleted message`r`n"
$stream=[ImapTestStream]::new($utf.GetBytes($response));$batch=Email-ScanStream $stream @{lines=@('* OK [UIDVALIDITY 43] UIDs')} @{validity='43';lastUid='21';backfillUid='0';backfillUntil='1'}
Assert ($batch.lastUid -eq '21' -and $batch.backfillUid -eq '1' -and !$batch.olderPending) 'Old backlog cursor never rewinds new-mail cursor'
$Store=Join-Path ([IO.Path]::GetTempPath()) ('ditasha-mail-'+[Guid]::NewGuid());$null=[IO.Directory]::CreateDirectory($Store)
try{
 function Mail-TaskInfo {return @{registered=$false;nextRun='';lastResult=$null}}
 function Load-Json {return @()}
 function Mail-Save($state){$script:saved=ConvertTo-Json -InputObject $state -Depth 12 -Compress}
 $ad=Mail-Record @{id='a';email='a@example.test'} '1' @{uid='1';messageId='ad';subject='Set the mood with 2 free months of Premium';from='music@example.test';date='2026-10-07';content='USD 12.99 per month. Payment terms.'}
 $ad.category='Keuangan';$ad.review='pending';$ad | Add-Member -NotePropertyName classificationVersion -NotePropertyValue 1 -Force
 $paid=Mail-Record @{id='a';email='a@example.test'} '1' @{uid='2';messageId='paid';subject='You paid to Merchant for invoice 1';from='payments@example.test';date='2026-10-07';content='Payment successful Rp 125.000'}
 $reviewed=$paid.PSObject.Copy();$reviewed.id='reviewed';$reviewed.review='recorded';$reviewed.ledgerId='ledger-1';$reviewed | Add-Member -NotePropertyName classificationVersion -NotePropertyValue 1 -Force
 $script:archive=[pscustomobject]@{enabled=$false;lastRun='';lastError='';exportError='';nextAccount=0;cursors=@();records=@($ad,$paid,$reviewed);accounts=@()}
 function Load-Json {return $script:archive}
 $migrated=Mail-State;Assert ($migrated.records[0].category -eq 'Promosi' -and !$migrated.records[0].review) 'Old false payment automatically reclassified'
 Assert ($migrated.records[2].review -eq 'recorded' -and $migrated.records[2].ledgerId -eq 'ledger-1') 'Reclassification preserves reviewed/recorded decisions'
 $context=Mail-FinanceContext $migrated;Assert ($context.total -eq 2 -and $context.pending -eq 1 -and $context.payments[0].subject -notmatch 'free months') 'AI evidence contains receipts, excludes advertisement and separates recorded count'
 function Load-Json {return @()}
 $state=Mail-State;$message.messageId='<same@example.test>'
 function Email($account,$action,$cursor){if($account.id -eq 'broken'){throw 'Connection failed'};return @{validity='42';lastUid='1';remaining=0;messages=@($message)}}
 $result=Mail-Scan $state @($a,@{id='broken';email='broken@example.test'},$b)
 Assert ($state.records.Count -eq 1 -and $state.cursors.Count -eq 2) 'Cross-account dedupe and independent cursors'
 Assert ($result.lastError.Contains('broken@example.test')) 'Failed account visibly reported'
 $result=Mail-Scan $state @($a,$b);Assert ($state.records.Count -eq 1) 'Repeated check does not duplicate payment'
 $state.records[0].subject='=HYPERLINK("https://evil.test","click")';$path=Mail-Export $state
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $zip=[IO.Compression.ZipFile]::OpenRead($path)
 try{foreach($entry in $zip.Entries){if($entry.FullName.EndsWith('.xml') -or $entry.FullName.EndsWith('.rels')){$reader=New-Object IO.StreamReader($entry.Open());try{[xml]$xml=$reader.ReadToEnd();Assert ($xml.DocumentElement -ne $null) ('Valid XML: '+$entry.FullName)}finally{$reader.Dispose()}}}
  $reader=New-Object IO.StreamReader($zip.GetEntry('xl/worksheets/sheet1.xml').Open());try{$sheet=$reader.ReadToEnd()}finally{$reader.Dispose()}
  Assert ($sheet.Contains('125000') -and $sheet.Contains('t="inlineStr"') -and !$sheet.Contains('<f>')) 'Typed amount and no formula injection'
 }finally{$zip.Dispose()}
 if($TestSchedule){
  # The task starts in 20 minutes; remove it before this isolated test ends.
  Mail-Schedule $true;$task=(Mail-TaskService).GetFolder('\').GetTask((Mail-TaskName));[xml]$taskXML=$task.Xml
  Assert ($taskXML.Task.Triggers.TimeTrigger.Repetition.Interval -eq 'PT20M') '20-minute repetition'
  Assert ($taskXML.Task.Principals.Principal.LogonType -eq 'InteractiveToken') 'No Windows password stored'
  Assert ($taskXML.Task.Actions.Exec.Arguments.Contains('-Automatic')) 'Actual background worker action'
  Mail-Schedule $false
 }
}finally{if($TestSchedule){try{Mail-Schedule $false}catch{}};[IO.Directory]::Delete($Store,$true)}
'Passed: mail categories, conservative multi-currency extraction, bill/receipt/refund separation, UIDVALIDITY and pagination, read-only fetches, cross-account dedupe, retry/failure progress and Excel XML/formula protection.'
