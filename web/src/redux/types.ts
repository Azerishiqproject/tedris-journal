// Ortak tip tanımlamaları

// Auth types
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'teacher';
  specialty?: string;
  academicDegree?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

// Teacher types 
export interface Teacher {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  specialty?: string;
  academicDegree?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeacherState {
  teachers: Teacher[];
  isLoading: boolean;
  error: string | null;
  currentTeacher: Teacher | null;
}

export interface CreateTeacherRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  specialty?: string;
  academicDegree?: string;
}

export interface UpdateTeacherRequest {
  id: string;
  teacherData: {
    firstName: string;
    lastName: string;
    email: string;
    specialty?: string;
    academicDegree?: string;
    password?: string;
  }
}

// Course types
export interface Course {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseState {
  courses: Course[];
  isLoading: boolean;
  error: string | null;
  currentCourse: Course | null;
}

export interface CreateCourseRequest {
  name: string;
  description?: string;
}

export interface UpdateCourseRequest {
  id: string;
  courseData: {
    name: string;
    description?: string;
  }
}

// CourseType types
export interface CourseType {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseTypeState {
  courseTypes: CourseType[];
  isLoading: boolean;
  error: string | null;
  currentCourseType: CourseType | null;
}

export interface CreateCourseTypeRequest {
  name: string;
  description?: string;
}

export interface UpdateCourseTypeRequest {
  id: string;
  courseTypeData: {
    name: string;
    description?: string;
  }
}

// Location types
export interface Location {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocationState {
  locations: Location[];
  isLoading: boolean;
  error: string | null;
  currentLocation: Location | null;
}

export interface CreateLocationRequest {
  name: string;
  description?: string;
}

export interface UpdateLocationRequest {
  id: string;
  locationData: {
    name: string;
    description?: string;
  }
}

// Leave types
export interface Leave {
  id: string;
  teacherId: string;
  teacherName?: string;
  startDate: string;
  endDate: string;
  reason: string;
  status?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveState {
  leaves: Leave[];
  isLoading: boolean;
  error: string | null;
  currentLeave: Leave | null;
}

export interface CreateLeaveRequest {
  teacherId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  notes?: string;
}

export interface UpdateLeaveRequest {
  id: string;
  leaveData: {
    teacherId: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    notes?: string;
    status?: string;
  }
}

// Schedule types
export interface Schedule {
  id: string;
  courseId: string;
  courseName: string;
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  locationId: string;
  locationName: string;
  courseTypeId: string;
  type: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleState {
  schedules: Schedule[];
  isLoading: boolean;
  error: string | null;
  currentSchedule: Schedule | null;
  conflict: ConflictInfo | null;
}

export interface CreateScheduleRequest {
  courseId: string;
  teacherId: string;
  locationId: string;
  courseTypeId: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
}

export interface UpdateScheduleRequest {
  id: string;
  scheduleData: {
    courseId: string;
    teacherId: string;
    locationId: string;
    courseTypeId: string;
    date: string;
    startTime: string;
    endTime: string;
    subject: string;
  }
}

export interface ConflictInfo {
  hasConflict: boolean;
  type?: 'teacher' | 'location' | 'leave';
  conflictingId?: string;
  message?: string;
} 