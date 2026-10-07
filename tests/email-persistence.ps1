param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference='Stop'
$sourcePath=(Resolve-Path $Source).Path
$text=[IO.File]::ReadAllText($sourcePath);$start=$text.IndexOf('$ErrorActionPreference');$cut=$text.IndexOf('. (Join-Path $PSScriptRoot')
Invoke-Expression $text.Substring($start,$cut-$start)
function Assert($value,$message){if(!$value){throw $message}}
$Store=Join-Path ([IO.Path]::GetTempPath()) ('ditasha-vault-'+[Guid]::NewGuid());$null=[IO.Directory]::CreateDirectory($Store)
try{
 $accounts=@(@{id='one';label='Personal';email='one@example.test';host='imap.example.test';password='TEST-ONLY-SECRET'},@{id='two';label='Work';email='two@example.test';host='imap.example.test';password='OTHER-TEST-SECRET'})
 Save-Json 'mail-accounts.dpapi' $accounts $true
 $vault=Join-Path $Store 'mail-accounts.dpapi';$original=[IO.File]::ReadAllBytes($vault)
 Assert (!$utf.GetString($original).Contains('TEST-ONLY-SECRET')) 'Saved credentials are encrypted'
 # Fresh PowerShell processes model restart and replacement of the installed scripts.
 $scriptPath=Join-Path $Store 'assistant-tools.ps1';Copy-Item $sourcePath $scriptPath
 Copy-Item (Join-Path ([IO.Path]::GetDirectoryName($sourcePath)) 'mail-automation.ps1') (Join-Path $Store 'mail-automation.ps1')
 function Status { $result='{"action":"status"}' | & powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $scriptPath -Store $Store;if($LASTEXITCODE -ne 0){throw 'Status process failed'};return ($result | ConvertFrom-Json) }
 $result=Status;Assert ($result.ok -and @($result.data.accounts).Count -eq 2) 'Both accounts load after restart'
 Assert (($result | ConvertTo-Json -Depth 12) -notmatch 'TEST-ONLY-SECRET|OTHER-TEST-SECRET|password') 'Status never exposes passwords'
 Copy-Item $sourcePath $scriptPath -Force;$result=Status
 Assert ($result.ok -and @($result.data.accounts).Count -eq 2) 'Updating installed script preserves saved accounts'
 Assert ([Convert]::ToBase64String($original) -eq [Convert]::ToBase64String([IO.File]::ReadAllBytes($vault))) 'Normal update never rewrites the credential vault'
 [IO.File]::WriteAllBytes($vault,[byte[]](1,2,3));$result=Status
 Assert ($result.ok -and @($result.data.accounts).Count -eq 2) 'Unreadable primary recovers from encrypted backup'
 Assert (@(Get-ChildItem $Store -Filter '*.unreadable-*').Count -eq 1) 'Original unreadable file preserved'
 # Removing access must also remove that account from the recovery copy.
 Save-Json 'mail-accounts.dpapi' @($accounts[1]) $true;[IO.File]::Delete($vault);$result=Status
 Assert ($result.ok -and @($result.data.accounts).Count -eq 1 -and $result.data.accounts[0].id -eq 'two') 'Recovery never restores a removed account'
 [IO.File]::WriteAllBytes($vault,[byte[]](1,2,3));[IO.File]::WriteAllBytes($vault+'.bak',[byte[]](4,5,6));$result=Status
 Assert (!$result.ok) 'Unreadable vault is an error, not an empty account list'
 Assert ([IO.File]::ReadAllBytes($vault).Length -eq 3) 'Read failure does not erase accounts'
}finally{[IO.Directory]::Delete($Store,$true)}
'Passed: encrypted multiple email accounts survive restart and script update, status excludes passwords, recovery preserves unreadable files and removed accounts, unrecoverable data is not erased.'
