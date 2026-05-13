# backend/app/celery_app.py
from celery import Celery
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery = Celery(
    "pfe_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.analyse_task"],
)

celery.conf.update(
    task_serializer          = "json",
    result_serializer        = "json",
    accept_content           = ["json"],
    worker_concurrency       = 1,        # 1 analyse à la fois
    worker_prefetch_multiplier = 1,
    broker_connection_retry_on_startup = True,
    result_expires           = 86400,    # résultats gardés 24h
    task_time_limit          = 700,      # 11 min max par tâche
    task_soft_time_limit     = 660,
    timezone                 = "Africa/Tunis",
    enable_utc               = True,
)