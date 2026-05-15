FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY generator/ ./generator/
COPY notification_service/ ./notification_service/

ENV PYTHONUNBUFFERED=1

EXPOSE 8002

CMD ["uvicorn", "notification_service.main:app", "--host", "0.0.0.0", "--port", "8002"]