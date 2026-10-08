param([string]$Source)
$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('ditasha-office-test-'+[Guid]::NewGuid())
$null=[IO.Directory]::CreateDirectory($root)
try {
 $script=Join-Path $root 'assistant-tools.ps1';$store=Join-Path $root 'store';$null=[IO.Directory]::CreateDirectory($store)
 $text=[IO.File]::ReadAllText((Resolve-Path $Source))
 # Keep the real dispatcher and disk handshake; replace only email access/state.
 $needle='. (Join-Path $PSScriptRoot ''mail-automation.ps1'')'
 $stubs="`nfunction Mail-State {return [pscustomobject]@{enabled=`$true}}`nfunction Mail-Scan {return @{scanned=`$true}}`n"
 if(!$text.Contains($needle)){throw 'Missing helper import'}
 [IO.File]::WriteAllText($script,$text.Replace($needle,$needle+$stubs))
 Copy-Item (Join-Path (Split-Path (Resolve-Path $Source)) 'mail-automation.ps1') $root
 $script:engine=Join-Path $PSHOME $(if($PSVersionTable.PSEdition -eq 'Desktop'){'powershell.exe'}elseif($IsWindows){'pwsh.exe'}else{'pwsh'})
 function Call($action){$json=(@{action=$action}|ConvertTo-Json -Compress) | & $script:engine -NoProfile -File $script -Store $store;$r=$json|ConvertFrom-Json;if(!$r.ok){throw $r.error};return $r.data}
 if((Call 'mailOfficePulse').due){throw 'Fresh office unexpectedly has due work'}
 if(!(Call 'mailAutomatic').deferred){throw 'Live office must defer scan until desk arrival'}
 if(!(Call 'mailOfficePulse').due){throw 'Pending request must survive until claimed'}
 if(!(Call 'mailScan').scanned){throw 'Desk-controlled manual scan must run'}
 if((Call 'mailOfficePulse').due){throw 'Completed request must clear'}
 [IO.File]::WriteAllText((Join-Path $store 'office-mail-heartbeat.json'),'{"seen":"2000-01-01T00:00:00Z"}')
 if(!(Call 'mailAutomatic').scanned){throw 'Closed/crashed office must fall back to background scan'}
 Write-Output 'Passed: Windows scan handoff, durable due request, completion acknowledgement and stale-office fallback.'
} finally {Remove-Item -LiteralPath $root -Recurse -Force}
