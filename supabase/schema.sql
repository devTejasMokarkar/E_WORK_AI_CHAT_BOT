-- e-Work Chatbot Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (e-Work registered users)
CREATE TABLE IF NOT EXISTS ework_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mobile_number VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  sso_id VARCHAR(100) UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'District User',
  user_level VARCHAR(50) NOT NULL DEFAULT 'District',
  district VARCHAR(100),
  block VARCHAR(100),
  gram_panchayat VARCHAR(100),
  department VARCHAR(100),
  agency VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Works table
CREATE TABLE IF NOT EXISTS works (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id VARCHAR(50) UNIQUE NOT NULL,
  work_name VARCHAR(500) NOT NULL,
  scheme_name VARCHAR(200),
  financial_year VARCHAR(20),
  district VARCHAR(100),
  block VARCHAR(100),
  gram_panchayat VARCHAR(100),
  status VARCHAR(100) DEFAULT 'Proposed',
  sanctioned_amount DECIMAL(15, 2) DEFAULT 0,
  physical_progress INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sanctions table (Administrative, Technical, Financial)
CREATE TABLE IF NOT EXISTS sanctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- Administrative, Technical, Financial
  sanction_number VARCHAR(100),
  sanction_date DATE,
  amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Measurement Books table
CREATE TABLE IF NOT EXISTS measurement_books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  mb_number INTEGER NOT NULL,
  mb_type VARCHAR(20) NOT NULL, -- Running MB, Final MB
  amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  voucher_number VARCHAR(50) UNIQUE NOT NULL,
  voucher_date DATE,
  gross_amount DECIMAL(15, 2) DEFAULT 0,
  net_amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Pending',
  fto_status VARCHAR(20) DEFAULT 'Not Generated',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- FTO (Fund Transfer Order) table
CREATE TABLE IF NOT EXISTS ftos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
  fto_number VARCHAR(50) UNIQUE NOT NULL,
  fto_date DATE,
  amount DECIMAL(15, 2) DEFAULT 0,
  ifms_status VARCHAR(20) DEFAULT 'Pending',
  payment_status VARCHAR(20) DEFAULT 'Pending',
  utr_number VARCHAR(50),
  payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Utilization Certificates table
CREATE TABLE IF NOT EXISTS utilization_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  uc_number VARCHAR(50) UNIQUE NOT NULL,
  uc_date DATE,
  amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Completion Certificates table
CREATE TABLE IF NOT EXISTS completion_certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  cc_number VARCHAR(50) UNIQUE NOT NULL,
  cc_date DATE,
  completion_amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'Pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Work Photos table
CREATE TABLE IF NOT EXISTS work_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id UUID REFERENCES works(id) ON DELETE CASCADE,
  photo_url TEXT,
  work_stage VARCHAR(200),
  physical_progress INTEGER DEFAULT 0,
  upload_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(100),
  user_mobile VARCHAR(20),
  user_query TEXT,
  bot_response TEXT,
  language VARCHAR(10),
  intent VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Knowledge Base for RAG
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content TEXT NOT NULL,
  category VARCHAR(100),
  source VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ework_users_mobile ON ework_users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_works_work_id ON works(work_id);
CREATE INDEX IF NOT EXISTS idx_works_district ON works(district);
CREATE INDEX IF NOT EXISTS idx_works_block ON works(block);
CREATE INDEX IF NOT EXISTS idx_sanctions_work_id ON sanctions(work_id);
CREATE INDEX IF NOT EXISTS idx_measurement_books_work_id ON measurement_books(work_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_work_id ON vouchers(work_id);
CREATE INDEX IF NOT EXISTS idx_ftos_voucher_id ON ftos(voucher_id);
CREATE INDEX IF NOT EXISTS idx_utilization_certificates_work_id ON utilization_certificates(work_id);
CREATE INDEX IF NOT EXISTS idx_completion_certificates_work_id ON completion_certificates(work_id);
CREATE INDEX IF NOT EXISTS idx_work_photos_work_id ON work_photos(work_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_mobile ON audit_logs(user_mobile);