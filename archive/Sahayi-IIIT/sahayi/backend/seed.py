import asyncio
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from db.models import Base, Patient, SignalRecord
from core.config import get_settings
from agents.population_intelligence import PopulationIntelligenceAgent
from db.database import DatabaseGateway
from rag.pubmed_client import PubMedClient

async def seed():
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with SessionLocal() as session:
        # Create Thankamma
        thankamma = Patient(
            name="Thankamma",
            language="ml-IN",
            phone_number="+919876543210",
            registration_number="REG001",
            conditions=["Diabetes", "Hypertension"],
            medicines=[
                {"name": "Metformin", "dose": "500mg", "time": "After breakfast"},
                {"name": "Amlodipine", "dose": "5mg", "time": "Night"}
            ],
            doctor_uid="demo_doctor_123",
            doctor_email="doctor@example.com",
            relatives=[{"name": "Son (Dubai)", "phone": "+971501234567", "whatsapp_number": "+971501234567", "relationship": "Son"}]
        )
        session.add(thankamma)
        await session.commit()
        await session.refresh(thankamma)
        
        # Add a signal record
        signal = SignalRecord(
            patient_id=thankamma.id,
            session_id="session_001",
            fatigue=True,
            appetite="decreased",
            duration_days=3,
            severity=3,
            red_flag=False,
            symptom_description="patient ate burger and he vomited",
            source_text="I have been feeling very tired for 3 days and I am not eating well.",
            confidence=0.9
        )
        session.add(signal)
        

        await session.commit()
        
        db_gateway = DatabaseGateway()
        pubmed_client = PubMedClient()
        agent = PopulationIntelligenceAgent(db_gateway, pubmed_client)
        await agent.run()
        
        print("Database seeded with Thankamma's data!")

if __name__ == "__main__":
    asyncio.run(seed())
