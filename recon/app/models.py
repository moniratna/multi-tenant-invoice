from sqlalchemy import Column, String, DECIMAL, DateTime, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ENUM
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import uuid

Base = declarative_base()

# Enums
invoice_status_enum = ENUM('open', 'matched', 'paid', name='invoice_status', create_type=False)
currency_enum = ENUM('USD', 'EUR', 'GBP', 'INR', name='currency', create_type=False)

class Tenant(Base):
    __tablename__ = 'tenants'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    invoices = relationship("Invoice", back_populates="tenant")
    bank_transactions = relationship("BankTransaction", back_populates="tenant")


class Vendor(Base):
    __tablename__ = 'vendors'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    invoices = relationship("Invoice", back_populates="vendor")


class Invoice(Base):
    __tablename__ = 'invoices'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey('vendors.id', ondelete='SET NULL'), nullable=True)
    invoice_number = Column(String(100), nullable=True)
    amount = Column(DECIMAL(15, 2), nullable=False)
    currency = Column(currency_enum, default='USD', nullable=False)
    invoice_date = Column(DateTime(timezone=True), nullable=True)
    description = Column(Text, nullable=True)
    status = Column(invoice_status_enum, default='open', nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="invoices")
    vendor = relationship("Vendor", back_populates="invoices")


class BankTransaction(Base):
    __tablename__ = 'bank_transactions'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False)
    external_id = Column(String(255), nullable=True)
    posted_at = Column(DateTime(timezone=True), nullable=False)
    amount = Column(DECIMAL(15, 2), nullable=False)
    currency = Column(currency_enum, default='USD', nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="bank_transactions")