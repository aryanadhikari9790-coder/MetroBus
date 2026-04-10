from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from rest_framework_simplejwt.tokens import AccessToken, TokenError

from accounts.models import User


@database_sync_to_async
def _get_user_from_token(raw_token: str):
    if not raw_token:
        return AnonymousUser()
    try:
        access_token = AccessToken(raw_token)
        user_id = access_token.get("user_id")
        return User.objects.filter(id=user_id, is_active=True).first() or AnonymousUser()
    except TokenError:
        return AnonymousUser()
    except Exception:
        return AnonymousUser()


class JwtQueryAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        close_old_connections()
        query_string = scope.get("query_string", b"").decode()
        token = parse_qs(query_string).get("token", [None])[0]
        scope["user"] = await _get_user_from_token(token)
        return await super().__call__(scope, receive, send)
