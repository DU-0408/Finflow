FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY generator/ ./generator/
COPY fraud_service/ ./fraud_service/

ENV PYTHONUNBUFFERED=1

EXPOSE 8001

CMD ["uvicorn", "fraud_service.main:app", "--host", "0.0.0.0", "--port", "8001"]