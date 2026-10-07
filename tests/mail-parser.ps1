param([string]$Source)
$ErrorActionPreference='Stop'
$sourceText=[IO.File]::ReadAllText($Source)
$cut=$sourceText.IndexOf("try{`n `$request=")
if($cut -lt 0){throw 'Cannot locate main request boundary'}
$functions=$sourceText.Substring($sourceText.IndexOf("`$ErrorActionPreference"),$cut-$sourceText.IndexOf("`$ErrorActionPreference"))
Invoke-Expression $functions
function Assert($value,$message){if(!$value){throw $message}}
Assert ((Decode-Header '=?utf-8?B?SGVsbG8g5LiW55WM?=') -eq 'Hello 世界') 'Base64 header'
Assert ((Decode-Header '=?UTF-8?Q?Hello_world_=E2=9C=93?=') -eq 'Hello world ✓') 'Quoted printable header'
Assert ((Header "Subject: Hello`r`n world`r`nFrom: Test" 'Subject') -eq 'Hello world') 'Folded header'
$raw="Content-Type: multipart/alternative; boundary=`"abc`"`r`n`r`n--abc`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Transfer-Encoding: base64`r`n`r`nSGVsbG8gTG9yYQ==`r`n--abc`r`nContent-Type: text/html`r`n`r`n<b>Other</b>`r`n--abc--"
Assert ((Mail-Preview $raw) -eq 'Hello Lora') 'Multipart selects plain text'
Assert ((Mail-Preview "Content-Type: text/html`r`n`r`n<script>bad()</script><p>Hello &amp; Lora</p>") -eq 'Hello & Lora') 'HTML sanitization'
Add-Type @'
using System;using System.IO;
public class ImapTestStream:Stream {
 MemoryStream input;public MemoryStream sent=new MemoryStream();public ImapTestStream(byte[] bytes){input=new MemoryStream(bytes);}
 public override bool CanRead=>true;public override bool CanWrite=>true;public override bool CanSeek=>false;public override long Length=>input.Length;public override long Position{get=>input.Position;set=>throw new NotSupportedException();}
 public override int Read(byte[] b,int o,int n)=>input.Read(b,o,Math.Min(n,3));public override int ReadByte()=>input.ReadByte();public override void Write(byte[] b,int o,int n)=>sent.Write(b,o,n);public override void Flush(){}public override long Seek(long a,SeekOrigin b)=>throw new NotSupportedException();public override void SetLength(long a)=>throw new NotSupportedException();
}
'@
$script:tag=0;$literal="Subject: Hello`r`nFrom: test@example.com`r`n`r`n";$bytes=$utf.GetBytes("* 1 FETCH (BODY[HEADER] {$($utf.GetByteCount($literal))}`r`n"+$literal+")`r`nD1 OK fetched`r`n")
$stream=[ImapTestStream]::new($bytes);$r=Imap-Command $stream 'UID FETCH 8 (BODY.PEEK[HEADER])'
Assert ($r.literals.Count -eq 1 -and $r.literals[0] -eq $literal) 'Partial literal reads preserved'
Assert ($utf.GetString($stream.sent.ToArray()).Contains('BODY.PEEK')) 'Read-only fetch'
$script:tag=0;$bad=[ImapTestStream]::new($utf.GetBytes("D1 NO rejected`r`n"));$failed=$false;try{$null=Imap-Command $bad 'LOGIN test test'}catch{$failed=$true};Assert $failed 'IMAP rejection must fail'
$script:tag=0;$large=[ImapTestStream]::new($utf.GetBytes("* 1 FETCH (BODY[] {999999}`r`n"));$failed=$false;try{$null=Imap-Command $large 'UID FETCH 1'}catch{$failed=$true};Assert $failed 'Oversized literal rejected'
'Passed: MIME plain/HTML previews, encoded/folded headers, exact partial literal reads, read-only commands, IMAP failure and size caps.'
