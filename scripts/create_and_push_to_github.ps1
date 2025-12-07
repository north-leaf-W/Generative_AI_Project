param(
  [string]$RepoName = "生成式人工智能项目课",
  [ValidateSet("private","public")]
  [string]$Visibility = "private",
  [string]$Username,
  [string]$Token
)

if (-not $Username -or -not $Token) {
  Write-Host "请提供参数：-Username <你的GitHub用户名> -Token <你的GitHub个人访问令牌>" -ForegroundColor Yellow
  Write-Host "令牌需至少具备 'repo' 权限。" -ForegroundColor Yellow
  exit 1
}

# 创建 GitHub 仓库
$headers = @{
  Authorization = "Bearer $Token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

$body = @{ name = $RepoName; private = ($Visibility -eq "private") } | ConvertTo-Json

try {
  $resp = Invoke-RestMethod -Method Post -Uri "https://api.github.com/user/repos" -Headers $headers -Body $body
  Write-Host "已在 GitHub 创建仓库：" $resp.html_url -ForegroundColor Green
} catch {
  Write-Host "创建仓库失败：" $_.Exception.Message -ForegroundColor Red
  exit 1
}

# 配置远程并推送（使用令牌避免交互）
try { git remote remove origin | Out-Null } catch {}

$remoteWithToken = "https://$Username:$Token@github.com/$Username/$RepoName.git"
$remoteClean = "https://github.com/$Username/$RepoName.git"

git remote add origin $remoteWithToken
git push -u origin main

# 安全起见，移除令牌信息
git remote set-url origin $remoteClean

Write-Host "推送完成，已将远程URL还原为不含令牌：" $remoteClean -ForegroundColor Green
