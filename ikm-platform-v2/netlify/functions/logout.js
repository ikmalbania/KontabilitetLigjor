const { clearCookieHeaders } = require('./_session');

exports.handler = async () => {
  return {
    statusCode: 200,
    multiValueHeaders: { 'Set-Cookie': clearCookieHeaders() },
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
