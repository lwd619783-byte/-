param([Parameter(Mandatory=$true)][string]$PreviewUrl, [Parameter(Mandatory=$true)][string]$RedirectUri)
$ErrorActionPreference = 'Stop'
$bridgeCredential = Read-Host '输入研究桥访问密钥（不回显，不保存）' -AsSecureString
$bridgePointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($bridgeCredential)
$previousBridgeCredential = $env:BRIDGE_OWNER_SECRET
try {
  $env:BRIDGE_OWNER_SECRET = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bridgePointer)
  node "$PSScriptRoot/research-bridge-preview-check.mjs" $PreviewUrl $RedirectUri
  if ($LASTEXITCODE -ne 0) { throw '远程验收未通过；请查看安全报告，不要发送密钥。' }
} finally {
  $env:BRIDGE_OWNER_SECRET = $previousBridgeCredential
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bridgePointer)
  $bridgeCredential.Dispose()
}
