FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all service code
COPY generator/ ./generator/
COPY api_gateway/ ./api_gateway/

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "api_gateway.main:app", "--host", "0.0.0.0", "--port", "8000"]