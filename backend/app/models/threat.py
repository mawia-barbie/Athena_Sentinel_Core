from sqlalchemy import Column, Integer, String, DateTime, JSON, Index
from sqlalchemy.sql import func
from app.core.database import Base

class Threat(Base):
    __tablename__ = 'threats'
    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(128), nullable=True, index=True)  # e.g. CVE-2024-1234 or vendor advisory id
    title = Column(String(256), nullable=False)
    description = Column(String(2048), nullable=True)
    type = Column(String(64), nullable=False, index=True)  # CVE, Malware, Phishing, Ransomware, Exploit, Other
    severity = Column(String(16), nullable=False, index=True)
    source = Column(String(128), nullable=True)
    url = Column(String(512), nullable=True)
    tags = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), server_onupdate=func.now(), nullable=False)

# index for common queries and dedupe
Index('ix_threats_external_id', Threat.external_id)
Index('ix_threats_type_severity', Threat.type, Threat.severity)
