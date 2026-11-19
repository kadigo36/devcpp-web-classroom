export default function handler(_request, response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.status(200).json({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  });
}
