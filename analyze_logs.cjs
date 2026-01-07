
const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'logs_result.json');

try {
  const data = fs.readFileSync(logPath, 'utf8');
  const logs = JSON.parse(data);

  console.log(`Total logs: ${logs.length}`);

  const errors = logs.filter(log => {
    // 过滤出错误状态码，或者包含 chat 的请求
    // 注意：requestPath 可能不包含 query string，所以尽量宽松
    return (log.responseStatusCode >= 400) || (log.requestPath && log.requestPath.includes('chat'));
  });

  console.log(`Found ${errors.length} relevant logs:`);
  
  errors.forEach(log => {
    console.log('--------------------------------------------------');
    console.log(`Time: ${log.TimeUTC}`);
    console.log(`Path: ${log.requestPath}`);
    console.log(`Method: ${log.requestMethod}`);
    console.log(`Status: ${log.responseStatusCode}`);
    // console.log(`Message: ${log.message}`); // Message 可能是空
    if (log.level) console.log(`Level: ${log.level}`);
  });

} catch (err) {
  console.error('Error analyzing logs:', err);
}
