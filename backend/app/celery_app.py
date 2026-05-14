from celery import Celery
import os

CELERY_BROKER_URL = os.getenv(
    "CELERY_BROKER_URL",
    os.getenv("REDIS_URL", "redis://redis:6379/0")
)

celery = Celery(
    "pfe_worker",
    broker=CELERY_BROKER_URL,
    include=["app.tasks.analyse_task"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_ignore_result=True,
    result_backend=None,
    worker_concurrency=1,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=None,
    task_time_limit=3600,
    task_soft_time_limit=3500,
    timezone="Africa/Tunis",
    enable_utc=True,
)
