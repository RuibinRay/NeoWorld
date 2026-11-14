# Saves your Higgsfield API secret for your Windows user (as HF_API_KEY_SECRET), typed in hidden,
# then tests the key. The secret is never written to this folder or shown on screen.
$secure = Read-Host -AsSecureString 'Paste your Higgsfield API secret (it stays hidden) and press Enter'
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)).Trim()
if (-not $plain) { Write-Host 'Nothing was entered; nothing saved.'; exit 1 }
[Environment]::SetEnvironmentVariable('HF_API_KEY_SECRET', $plain, 'User')
Write-Host "Saved ($($plain.Length) characters). Testing the key with Higgsfield..."
$env:HF_API_KEY_SECRET = $plain
$env:HF_API_KEY_ID = [Environment]::GetEnvironmentVariable('HF_API_KEY_ID', 'User')
& node (Join-Path $PSScriptRoot 'higgsfield.mjs') check
