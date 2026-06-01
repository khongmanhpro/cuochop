export function verifyCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");

  return authorization === `Bearer ${secret}` || headerSecret === secret;
}
