-- PAC-LAB database. Run through `npm run db:setup`, which creates the database first.
-- Re-running drops and recreates these tables, which also erases saved student progress.

SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS v_student_summary;
DROP TABLE IF EXISTS classroom_invites, classroom_members, classrooms, student_state, activity_log, simulation_runs, quiz_attempts, student_badges, experiment_progress, badges, students, classes, faculty, experiments, departments;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE departments (
  id TINYINT UNSIGNED PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL
);

CREATE TABLE faculty (
  id VARCHAR(16) PRIMARY KEY,
  full_name VARCHAR(80) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  department_id TINYINT UNSIGNED NOT NULL,
  designation VARCHAR(40) NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_faculty_department FOREIGN KEY (department_id) REFERENCES departments (id)
);

CREATE TABLE classes (
  id SMALLINT UNSIGNED PRIMARY KEY,
  code VARCHAR(12) NOT NULL UNIQUE,
  department_id TINYINT UNSIGNED NOT NULL,
  section CHAR(1) NOT NULL,
  semester TINYINT UNSIGNED NOT NULL,
  academic_year VARCHAR(9) NOT NULL,
  advisor_id VARCHAR(16) NOT NULL,
  room VARCHAR(20) NOT NULL,
  CONSTRAINT fk_class_department FOREIGN KEY (department_id) REFERENCES departments (id),
  CONSTRAINT fk_class_advisor FOREIGN KEY (advisor_id) REFERENCES faculty (id)
);

-- Students can only sign in when password_hash is set.
CREATE TABLE students (
  id VARCHAR(16) PRIMARY KEY,
  class_id SMALLINT UNSIGNED NOT NULL,
  first_name VARCHAR(40) NOT NULL,
  last_name VARCHAR(40) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NULL,
  enrolled_on DATE NOT NULL,
  last_active_at DATETIME NULL,
  INDEX idx_students_class (class_id),
  CONSTRAINT fk_student_class FOREIGN KEY (class_id) REFERENCES classes (id)
);

CREATE TABLE experiments (
  id TINYINT UNSIGNED PRIMARY KEY,
  title VARCHAR(80) NOT NULL,
  mission VARCHAR(30) NOT NULL,
  tier VARCHAR(12) NOT NULL,
  xp SMALLINT UNSIGNED NOT NULL,
  is_final BOOLEAN NOT NULL DEFAULT FALSE
);

-- One row per experiment a student has cleared or is currently working on (later ones are locked).
CREATE TABLE experiment_progress (
  student_id VARCHAR(16) NOT NULL,
  experiment_id TINYINT UNSIGNED NOT NULL,
  status ENUM('ready', 'in_progress', 'cleared') NOT NULL,
  steps_completed TINYINT UNSIGNED NOT NULL DEFAULT 0,
  stars TINYINT UNSIGNED NOT NULL DEFAULT 0,
  xp_earned SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  coins_earned SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  time_spent_min SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  cleared_at DATETIME NULL,
  PRIMARY KEY (student_id, experiment_id),
  INDEX idx_progress_experiment (experiment_id, status),
  CONSTRAINT fk_progress_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_experiment FOREIGN KEY (experiment_id) REFERENCES experiments (id)
);

CREATE TABLE quiz_attempts (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  student_id VARCHAR(16) NOT NULL,
  experiment_id TINYINT UNSIGNED NOT NULL,
  kind ENUM('pretest', 'posttest') NOT NULL,
  attempt_no TINYINT UNSIGNED NOT NULL,
  score TINYINT UNSIGNED NOT NULL,
  total TINYINT UNSIGNED NOT NULL DEFAULT 20,
  submitted_at DATETIME NOT NULL,
  INDEX idx_quiz_student (student_id, experiment_id, kind),
  CONSTRAINT fk_quiz_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_quiz_experiment FOREIGN KEY (experiment_id) REFERENCES experiments (id)
);

CREATE TABLE simulation_runs (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  student_id VARCHAR(16) NOT NULL,
  experiment_id TINYINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  metrics JSON NOT NULL,
  saved_at DATETIME NOT NULL,
  INDEX idx_sim_student (student_id, saved_at),
  CONSTRAINT fk_sim_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_sim_experiment FOREIGN KEY (experiment_id) REFERENCES experiments (id)
);

CREATE TABLE badges (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(40) NOT NULL,
  goal VARCHAR(120) NOT NULL,
  icon VARCHAR(20) NOT NULL,
  sort_order TINYINT UNSIGNED NOT NULL
);

CREATE TABLE student_badges (
  student_id VARCHAR(16) NOT NULL,
  badge_id VARCHAR(20) NOT NULL,
  earned_at DATETIME NOT NULL,
  PRIMARY KEY (student_id, badge_id),
  CONSTRAINT fk_sb_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
  CONSTRAINT fk_sb_badge FOREIGN KEY (badge_id) REFERENCES badges (id)
);

CREATE TABLE activity_log (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  student_id VARCHAR(16) NOT NULL,
  experiment_id TINYINT UNSIGNED NULL,
  event ENUM('login', 'open_step', 'quiz_submit', 'simulation_saved', 'experiment_cleared', 'badge_earned') NOT NULL,
  detail VARCHAR(120) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  INDEX idx_activity_student (student_id, created_at),
  INDEX idx_activity_time (created_at),
  CONSTRAINT fk_activity_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
);

-- The exact progress object the student's browser keeps, so it survives logout and other devices.
CREATE TABLE student_state (
  student_id VARCHAR(16) PRIMARY KEY,
  state JSON NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_state_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
);

-- Classrooms a teacher opens for one section (one per teacher and section). Students join with the
-- join code or link: the section's students, plus anyone whose email address the teacher invited.
CREATE TABLE classrooms (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  join_code CHAR(7) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  description VARCHAR(300) NOT NULL DEFAULT '',
  class_id SMALLINT UNSIGNED NOT NULL,
  faculty_id VARCHAR(16) NOT NULL,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_classroom_section (faculty_id, class_id),
  CONSTRAINT fk_classroom_class FOREIGN KEY (class_id) REFERENCES classes (id),
  CONSTRAINT fk_classroom_faculty FOREIGN KEY (faculty_id) REFERENCES faculty (id) ON DELETE CASCADE
);

CREATE TABLE classroom_members (
  classroom_id INT UNSIGNED NOT NULL,
  student_id VARCHAR(16) NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (classroom_id, student_id),
  INDEX idx_member_student (student_id),
  CONSTRAINT fk_member_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms (id) ON DELETE CASCADE,
  CONSTRAINT fk_member_student FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
);

-- Addresses a classroom invite went to (by email, so students who have not registered yet count too).
CREATE TABLE classroom_invites (
  classroom_id INT UNSIGNED NOT NULL,
  email VARCHAR(120) NOT NULL,
  invited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (classroom_id, email),
  CONSTRAINT fk_invite_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms (id) ON DELETE CASCADE
);

-- Totals per student, used by the faculty dashboards and leaderboards.
CREATE VIEW v_student_summary AS
SELECT
  s.id,
  s.class_id,
  s.first_name,
  s.last_name,
  s.email,
  s.last_active_at,
  COALESCE(SUM(p.xp_earned), 0) AS xp,
  COALESCE(SUM(p.coins_earned), 0) AS coins,
  COALESCE(SUM(p.stars), 0) AS stars,
  COALESCE(SUM(p.status = 'cleared'), 0) AS cleared,
  MAX(CASE WHEN p.status <> 'cleared' THEN p.experiment_id END) AS current_experiment
FROM students s
LEFT JOIN experiment_progress p ON p.student_id = s.id
GROUP BY s.id;
