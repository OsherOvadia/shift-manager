// User Roles
export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

// Employment Types
export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
}

// Shift Types
export enum ShiftType {
  MORNING = 'MORNING',
  EVENING = 'EVENING',
  EVENING_CLOSE = 'EVENING_CLOSE',
}

// Schedule Status
export enum ScheduleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

// Availability Submission Status
export enum SubmissionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REQUIRES_CHANGES = 'REQUIRES_CHANGES',
}

// Shift Assignment Status
export enum AssignmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

// Notification Types
export enum NotificationType {
  SCHEDULE_PUBLISHED = 'SCHEDULE_PUBLISHED',
  SHIFT_APPROVED = 'SHIFT_APPROVED',
  SHIFT_REJECTED = 'SHIFT_REJECTED',
  SHIFT_CHANGED = 'SHIFT_CHANGED',
  SUBMISSION_REMINDER = 'SUBMISSION_REMINDER',
  RULE_VIOLATION = 'RULE_VIOLATION',
}

// User interface
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  employmentType: EmploymentType;
  organizationId: string;
  isActive: boolean;
  createdAt: Date;
}

// Organization interface
export interface Organization {
  id: string;
  name: string;
  timezone: string;
  createdAt: Date;
}

// Business Settings interface
export interface BusinessSettings {
  id: string;
  organizationId: string;
  weekendDays: number[];
  submissionDeadlineDay: number;
  submissionDeadlineHour: number;
  createdAt: Date;
}

// Shift Template interface
export interface ShiftTemplate {
  id: string;
  organizationId: string;
  name: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  minStaff: number;
  maxStaff: number;
  isActive: boolean;
}

// Weekly Schedule interface
export interface WeeklySchedule {
  id: string;
  organizationId: string;
  weekStartDate: Date;
  status: ScheduleStatus;
  createdById: string;
  publishedAt?: Date;
  createdAt: Date;
}

// Availability Submission interface
export interface AvailabilitySubmission {
  id: string;
  userId: string;
  weekStartDate: Date;
  status: SubmissionStatus;
  submittedAt?: Date;
  createdAt: Date;
  slots?: AvailabilitySlot[];
}

// Availability Slot interface
export interface AvailabilitySlot {
  id: string;
  submissionId: string;
  shiftDate: Date;
  shiftType: ShiftType;
  preferenceRank: number;
}

// Shift Assignment interface
export interface ShiftAssignment {
  id: string;
  scheduleId: string;
  userId: string;
  shiftTemplateId: string;
  shiftDate: Date;
  status: AssignmentStatus;
  createdAt: Date;
}

// Notification interface
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date;
}

// Work Rules interface
export interface WorkRules {
  minShifts: number;
  minWeekendShifts: number;
}

// Validation Result interface
export interface ValidationResult {
  valid: boolean;
  violations: ValidationViolation[];
}

export interface ValidationViolation {
  type: string;
  message: string;
}

// Auth Types
export interface LoginDto {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  employmentType: EmploymentType;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'passwordHash'>;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
  organizationId: string;
}
