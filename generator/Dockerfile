FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY generator/ ./generator/

ENV PYTHONUNBUFFERED=1

CMD ["sh", "-c", "python -m generator.main --mode ${GENERATOR_MODE:-local} --tps ${GENERATOR_TPS:-10} --batch-size 50"]