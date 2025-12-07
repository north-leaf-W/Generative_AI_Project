-- Add mode column to sessions table
ALTER TABLE sessions 
ADD COLUMN mode text NOT NULL DEFAULT 'public' CHECK (mode IN ('public', 'dev'));

-- Update existing sessions to be public (default)
-- (Already handled by DEFAULT 'public')

-- Create index for performance
CREATE INDEX idx_sessions_mode ON sessions(mode);