from generator.factory import TransactionFactory
from fraud_service.rules import FraudRuleEngine

factory = TransactionFactory(fraud_rate=0.0)
tx = factory.generate()

engine = FraudRuleEngine()
result = engine.analyze(tx)
print(result)
