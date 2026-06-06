-- SQL Schema for Sports Management Hub
-- Run this in your Supabase SQL Editor

-- 1. Create Teams Table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  sport TEXT DEFAULT 'BASKETBALL',
  category TEXT,
  players_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Subjects (Players/Staff) Table
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id),
  name TEXT NOT NULL,
  last_name TEXT,
  birth_date DATE,
  dna_id TEXT,
  contact TEXT UNIQUE,
  role TEXT CHECK (role IN ('PLAYER', 'STAFF')),
  number INTEGER,
  position TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Health Incidents Table
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id),
  type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  status TEXT,
  date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Qualitative Reports (Evaluations) Table
CREATE TABLE evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id),
  coach_id UUID,
  date DATE,
  tactical TEXT,
  technical TEXT,
  physical TEXT,
  behavioral TEXT,
  season TEXT,
  comments TEXT,
  overall TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Set up Row Level Security (RLS)
-- For demo purposes, we will disable RLS so everything works out of the box.
-- In production, you should enable RLS and set proper policies.
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations DISABLE ROW LEVEL SECURITY;
