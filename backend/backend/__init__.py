try:
    # Import Celery when available so shared_task uses the configured app.
    from .celery import app as celery_app
except ModuleNotFoundError as exc:
    if exc.name != "celery":
        raise
    celery_app = None

__all__ = ('celery_app',)
