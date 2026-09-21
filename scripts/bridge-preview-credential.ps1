# Windows Credential Manager only. Dot-source for in-process use; no plaintext files or command arguments.
param([string]$Target, [switch]$Show)
$ErrorActionPreference = 'Stop'
if (-not ('BridgePreviewCredential' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class BridgePreviewCredential {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct Credential {
    public uint Flags, Type;
    public string TargetName, Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist, AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias, UserName;
  }
  [DllImport("advapi32.dll", EntryPoint="CredWriteW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool Write(ref Credential credential, uint flags);
  [DllImport("advapi32.dll", EntryPoint="CredReadW", CharSet=CharSet.Unicode, SetLastError=true)]
  static extern bool Read(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll")] static extern void CredFree(IntPtr credential);
  public static void Save(string target, string secret) {
    var blob = Marshal.StringToCoTaskMemUni(secret);
    try {
      var value = new Credential { Type=1, TargetName=target, UserName="research-os-preview-owner", CredentialBlobSize=(uint)Encoding.Unicode.GetByteCount(secret), CredentialBlob=blob, Persist=2 };
      if (!Write(ref value, 0)) throw new InvalidOperationException("Credential Manager write failed");
    } finally { Marshal.ZeroFreeCoTaskMemUnicode(blob); }
  }
  public static string Load(string target) {
    IntPtr ptr;
    if (!Read(target, 1, 0, out ptr)) throw new InvalidOperationException("Credential Manager entry unavailable");
    try { var value=Marshal.PtrToStructure<Credential>(ptr); return Marshal.PtrToStringUni(value.CredentialBlob,(int)value.CredentialBlobSize/2); }
    finally { CredFree(ptr); }
  }
}
'@
}
if ($Show) {
  if (-not $Target) { throw 'Credential target required' }
  Add-Type -AssemblyName System.Windows.Forms
  $credentialValue = [BridgePreviewCredential]::Load($Target)
  $dialog = New-Object Windows.Forms.Form
  $dialog.Text = '研究桥 Preview：本机安全取用'
  $dialog.Width = 690; $dialog.Height = 180; $dialog.StartPosition = 'CenterScreen'
  $label = New-Object Windows.Forms.Label
  $label.Text = '仅用于研究桥授权页的 owner 密钥；不要填入 OAuth Client Secret。勾选后本机显示，关闭即清除。'
  $label.SetBounds(15,15,640,35)
  $field = New-Object Windows.Forms.TextBox
  $field.SetBounds(15,55,640,26); $field.ReadOnly = $true; $field.UseSystemPasswordChar = $true; $field.Text = $credentialValue
  $reveal = New-Object Windows.Forms.CheckBox
  $reveal.Text = '显示密钥（仅本机查看）'; $reveal.SetBounds(15,95,300,25)
  $reveal.Add_CheckedChanged({ $field.UseSystemPasswordChar = -not $reveal.Checked })
  $dialog.Controls.AddRange(@($label,$field,$reveal))
  try { [void]$dialog.ShowDialog() } finally { $field.Text=''; $credentialValue=$null; $dialog.Dispose() }
}
