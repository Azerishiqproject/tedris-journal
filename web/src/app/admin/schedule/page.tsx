'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, Clock, MapPin, User, Plus, ChevronLeft, ChevronRight, Loader, CalendarRange, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { 
  fetchSchedules, 
  createSchedule, 
  updateSchedule, 
  deleteSchedule, 
  resetScheduleError,
  resetConflict,
  checkTeacherConflict,
  checkTeacherLeave
} from '@/redux/slices/scheduleSlice';
import { fetchTeachers } from '@/redux/slices/teacherSlice';
import { fetchLocations } from '@/redux/slices/locationSlice';
import { fetchCourseTypes } from '@/redux/slices/courseTypeSlice';
import { fetchSeasons } from '@/redux/slices/seasonSlice';
import { fetchLeaves, checkTeacherLeaves } from '@/redux/slices/leaveSlice';
import { Schedule as ReduxSchedule } from '@/redux/types';
import DatePicker from "react-datepicker";
import { registerLocale, setDefaultLocale } from "react-datepicker";
import { tr } from 'date-fns/locale';
import "react-datepicker/dist/react-datepicker.css";
import Select from 'react-select';

// Add custom styles for the DatePicker
const customDatePickerStyles = `
  .react-datepicker-popper {
    z-index: 9999 !important;
  }
  .react-datepicker-wrapper {
    display: block;
    width: 100%;
  }
`;

// Türkçe locale'i kaydet
registerLocale('tr', tr);
setDefaultLocale('tr');

// Form initial state
const emptyForm: FormData = {
  teacherIds: [] as SelectOption[],
  primaryTeacherId: '',
  locationId: '',
  courseTypeId: '',
  seasonId: '',
  date: new Date(),
  startTime: '09:00',
  endTime: '11:00',
  subject: ''
};

// Update Lesson interface
interface Schedule {
  id: string;
  teacherIds: string[] | { id: string; name: string; email: string }[];
  primaryTeacherId: string;
  primaryTeacherName?: string;
  locationId: string;
  courseTypeId: string;
  date: string;
  startTime: string;
  endTime: string;
  subject?: string;
  locationName?: string;
  type?: string;
}

interface Lesson extends Schedule {
  teacher?: {
    firstName?: string;
    lastName?: string;
    id?: string;
    _id?: string;
  };
  notes?: string;
  seasonId?: string;
  seasonName?: string;
  isChecked?: boolean;
  track?: number; // Track for vertical positioning
}

interface SnackbarState {
  open: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Add Teacher interface
interface Teacher {
  id?: string;
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

// Update SelectOption interface
interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly email?: string;
}

// Helper function to get type color
const getTypeColor = (typeId: string | undefined) => {
  switch(typeId) {
    case 'lecture':
      return 'bg-green-100 border-green-500 text-green-800';
    case 'practice':
      return 'bg-yellow-100 border-yellow-500 text-yellow-800';
    case 'exam':
      return 'bg-red-100 border-red-500 text-red-800';
    default:
      return 'bg-blue-100 border-blue-500 text-blue-800';
  }
};

// Update checkOverlap function
const checkOverlap = (lesson1: Lesson, lesson2: Lesson) => {
  if (lesson1.id === lesson2.id) return false;
  
  return (
    (lesson1.startTime <= lesson2.startTime && lesson1.endTime > lesson2.startTime) ||
    (lesson1.startTime >= lesson2.startTime && lesson1.startTime < lesson2.endTime)
  );
};

// Convert time string to minutes
const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Calculate position and width for grid view
const calculateGridPosition = (startTime: string, endTime: string) => {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  const startTimeInMinutes = startHour * 60 + startMinute;
  const endTimeInMinutes = endHour * 60 + endMinute;
  const totalDuration = endTimeInMinutes - startTimeInMinutes;
  
  // Başlangıç saati 08:00'dan itibaren ne kadar ileri
  const startOffset = startTimeInMinutes - (8 * 60);
  
  // Grid içinde başlangıç konumu (%)
  const left = `${(startOffset / (14 * 60)) * 100}%`;
  
  // Genişlik (%)
  const width = `${(totalDuration / (14 * 60)) * 100}%`;
  
  return { left, width };
};

// Generate hour labels for the grid
const hourLabels = Array.from({ length: 15 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);

// Format date for comparison
const formatDateForComparison = (date: Date) => {
  // Doğru ISO formatını oluşturmak için saat dilimi farkını düzelterek yapıyoruz
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Check if date is in the current week
const isDateInWeek = (dateStr: string, weekDates: Date[]) => {
  const date = new Date(dateStr);
  const dateStr2 = formatDateForComparison(date);
  
  // Hafta tarihlerinin formatlanmış halini alalım
  const formattedWeekDates = weekDates.map(d => formatDateForComparison(d));
  
  // Tarih, formatlanmış hafta tarihleri dizisinde var mı kontrol edelim
  return formattedWeekDates.includes(dateStr2);
};

// Move the formatDateForAPI function before it's used
// Helper function to format date for API requests
const formatDateForAPI = (date: Date) => {
  return date.toISOString().split('T')[0];
};

// Helper function to convert Schedule to Lesson
const scheduleToLesson = (schedule: ReduxSchedule | Schedule): Lesson => {
  // Create a new Lesson object with properties from the Schedule
  return {
    ...schedule,
    teacher: undefined // Will be populated when needed
  } as Lesson;
};

// Add 10 minutes to time string (HH:MM format)
const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  let totalMinutes = hours * 60 + minutes + minutesToAdd;
  
  // Handle overflow to next day
  if (totalMinutes >= 24 * 60) {
    totalMinutes = totalMinutes % (24 * 60);
  }
  
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
};

// Update create/update request interfaces
interface CreateScheduleRequest {
  teacherIds: string[];
  primaryTeacherId: string;
  locationId: string;
  courseTypeId: string;
  seasonId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  teacherId: string;
}

interface TeacherConflictParams {
  teacherIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  excludeLessonId?: string;
}



interface FormData {
  teacherIds: string[] | SelectOption[];
  primaryTeacherId: string;
  locationId: string;
  courseTypeId: string;
  seasonId: string;
  date: string | Date;
  startTime: string;
  endTime: string;
  subject: string;
}

// Move getCurrentWeekDates outside the component
const getCurrentWeekDates = (weekOffset: number) => {
  // Get the current date
  const currentDate = new Date();
  
  // Find the first day (Monday) of the current week
  const startOfWeek = new Date(currentDate);
  const day = currentDate.getDay();
  // In JavaScript, Sunday is 0, Monday is 1, etc.
  // We need to adjust to get Monday as the first day of the week
  const diff = day === 0 ? -6 : 1 - day; // If Sunday, go back 6 days, otherwise go back to Monday
  
  startOfWeek.setDate(currentDate.getDate() + diff);
  
  // Apply the week offset if user wants to see other weeks
  startOfWeek.setDate(startOfWeek.getDate() + (weekOffset * 7));
  
  // Generate days for the week (Monday to Sunday)
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });
};

export default function SchedulePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  
  // Form ref for scrolling
  const formRef = useRef<HTMLDivElement>(null);
  
  // Redux state'leri
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { schedules, isLoading, error, conflict } = useAppSelector((state) => state.schedules);
  const { teachers } = useAppSelector((state) => state.teachers);
  const { locations } = useAppSelector((state) => state.locations);
  const { courseTypes } = useAppSelector((state) => state.courseTypes);
  const { seasons } = useAppSelector((state) => state.seasons);
  
  // Yerel state'ler
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  
  // Snackbar state
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    type: 'success'
  });
  
  // Show snackbar message
  const showSnackbar = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setSnackbar({
      open: true,
      message,
      type
    });
    
    // Auto hide after 5 seconds
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, open: false }));
    }, 5000);
  };
  
  // Close snackbar
  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };
  
  // Add a new state for connection issues
  const [connectionIssue, setConnectionIssue] = useState(false);
  
  // Admin yetkisi kontrolü
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    } else if (!isAuthenticated) {
      router.push('/login');
    } else {
    }
  }, [user, isAuthenticated, router]);
  
  // Çakışma hatası durumunda form hatasını güncelle
  useEffect(() => {
    if (conflict?.hasConflict) {
      setFormError(conflict.message || 'Programda çakışma tespit edildi. Lütfen başka bir saat seçin.');
    }
  }, [conflict]);
  
  // Combine the date calculations into a single useMemo
  const { weekDates, dateParams } = useMemo(() => {
    // Calculate week dates
    const dates = getCurrentWeekDates(currentWeekOffset);
    
    // Calculate API parameters
    const params = {
      startDate: formatDateForAPI(dates[0]),
      endDate: formatDateForAPI(dates[6])
    };
    
    return { weekDates: dates, dateParams: params };
  }, [currentWeekOffset]); // Only depend on weekOffset
  
  // Format date for display with year
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'numeric', year: 'numeric' });
  };
  
  // Format day name for display
  const formatDayName = (date: Date) => {
    const dayNames = ['Bazar', 'Bazartəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
    return dayNames[date.getDay()];
  };
  
  // Navigate to previous period
  const goToPreviousPeriod = () => {
    setCurrentWeekOffset(currentWeekOffset - 1);
  };
  
  // Navigate to next period
  const goToNextPeriod = () => {
    setCurrentWeekOffset(currentWeekOffset + 1);
  };
  
  // Reset to current period
  const goToCurrentPeriod = () => {
    setCurrentWeekOffset(0);
  };

  // Handle form input changes
  const handleChange = (e?: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | null, fieldName?: string, value?: unknown) => {
    if (e) {
      const { name, value } = e.target;
      setFormData({ ...formData, [name]: value });
    } else if (fieldName) {
      setFormData({ ...formData, [fieldName]: value });
    }
    
    // Clear conflict message when inputs change
    setFormError(null);
    dispatch(resetScheduleError());
    dispatch(resetConflict());
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    console.log("Submitting form with data:", formData);
    
    if (!formData.teacherIds || (Array.isArray(formData.teacherIds) && formData.teacherIds.length === 0)) {
      setFormError('En az bir öğretmen seçmelisiniz');
      return;
    }
    
    try {
      // Convert date to formatted string
      const dateObj = typeof formData.date === 'string' ? new Date(formData.date) : formData.date;
      const formattedDate = formatDateForAPI(dateObj);
      
      // Convert teacherIds from SelectOption[] to string[] if needed
      const validTeacherIds = Array.isArray(formData.teacherIds) 
        ? formData.teacherIds.map((teacher: string | SelectOption) => {
            if (typeof teacher === 'string') return teacher;
            return teacher.value || '';
          }).filter(id => id.trim() !== '')
        : [];
      
      console.log("Processed teacher IDs:", validTeacherIds);
      
      // Make sure primary teacher is in the list
      if (formData.primaryTeacherId && !validTeacherIds.includes(formData.primaryTeacherId)) {
        validTeacherIds.push(formData.primaryTeacherId);
      }
      
      // Check for teacher conflicts before submitting
      let conflictDetected = false;
      
      // First check for conflicts
      const conflictParams = {
        teacherIds: validTeacherIds,
        date: formattedDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        excludeLessonId: editingId || undefined
      };
      
      console.log("Conflict check params:", JSON.stringify(conflictParams, null, 2));
      
      try {
        const conflictResult = await dispatch(checkTeacherConflict(conflictParams)).unwrap();
      
        if (conflictResult.hasConflict) {
          setFormError(conflictResult.message || 'Öğretmen çakışması tespit edildi. Lütfen başka bir saat seçin.');
          conflictDetected = true;
        return;
      }
      } catch (conflictError) {
        console.error("Teacher conflict check error:", conflictError);
        // Continue with form submission despite conflict check error
      }
      
      // Check for leave conflicts, but don't block form submission if server errors occur
      try {
        const leaveParams = {
          teacherIds: validTeacherIds,
        date: formattedDate
      };
      
        console.log("Teacher leave check params:", JSON.stringify(leaveParams, null, 2));
        
        // Try the client-side check first (more reliable)
        const leaveConflictResult = await dispatch(checkTeacherLeaves(leaveParams)).unwrap();
      
      if (leaveConflictResult.hasLeave) {
        setFormError(leaveConflictResult.message || "Öğretmenler bu tarihte izinli görünüyor.");
          conflictDetected = true;
        return;
      }
      
        // If client-side check passed, try server-side check too (if available)
        try {
          const serverLeaveCheck = await dispatch(checkTeacherLeave(leaveParams)).unwrap();
          if (serverLeaveCheck.hasLeave) {
            setFormError(serverLeaveCheck.message || "Öğretmenler bu tarihte izinli görünüyor.");
            conflictDetected = true;
            return;
          }
        } catch (serverCheckError) {
          console.warn("Server-side leave check failed, using client-side results:", serverCheckError);
        }
      } catch (leaveError) {
        console.error("Teacher leave check failed:", leaveError);
        // Add more detailed error handling
        setFormError("Öğretmen izin durumu kontrol edilemedi. Lütfen daha sonra tekrar deneyin.");
        conflictDetected = true;
        return;
      }
      
      if (conflictDetected) {
        return;
      }
      
      // Prepare the final request payload
      const scheduleData = {
        teacherIds: validTeacherIds,
        primaryTeacherId: formData.primaryTeacherId,
        locationId: formData.locationId,
        courseTypeId: formData.courseTypeId,
        seasonId: formData.seasonId || null,
        date: formattedDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        subject: formData.subject,
        teacherId: formData.primaryTeacherId  // Backward compatibility
      };
      
      console.log("Creating schedule with data:", JSON.stringify(scheduleData, null, 2));
      
      if (editingId) {
        await dispatch(updateSchedule({ id: editingId, scheduleData })).unwrap();
        showSnackbar('Ders ugurla güncellendi');
      } else {
        await dispatch(createSchedule(scheduleData)).unwrap();
        showSnackbar('Ders ugurla oluşturuldu');
      }
      
      // Reset form after successful submit
      resetForm();
      
      // Check if the lesson date is in the current week
      const selectedDate = typeof formData.date === 'string' ? new Date(formData.date) : formData.date;
      const isInCurrentWeek = isDateInWeek(formatDateForAPI(selectedDate), weekDates);
      
      // If the lesson is for a different week, calculate which week it's in
      if (!isInCurrentWeek) {
        // Calculate week difference from current date
        const today = new Date();
        const dayDiff = Math.round((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const weekDiff = Math.floor(dayDiff / 7);
        
        // Update the week offset to show the correct week
        setCurrentWeekOffset(weekDiff);
        
        // Use safe refresh with a short delay to ensure state updates first
        setTimeout(() => {
          safeRefreshSchedules();
        }, 300);
        
        // Show an additional message to inform the user
        showSnackbar('Dərs əlavə edildi və müvafiq həftəyə keçid edildi', 'success');
        return;
      }
      
      // If in current week, use safe refresh function instead of simple fetch
      await safeRefreshSchedules();
      
    } catch (error) {
      console.error('Form submission error:', error);
      setFormError('Ders kaydederken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  // Existing lesson düzenleme için
  const handleEdit = (lesson: Lesson) => {
    console.log("Editing lesson:", lesson);

    // Tüm öğretmenleri doğru formata dönüştürme
    const teacherOptions: SelectOption[] = [];
    
    // Handle different ways teachers might be represented
    if (Array.isArray(lesson.teacherIds)) {
      lesson.teacherIds.forEach(teacher => {
        if (typeof teacher === 'string') {
          // Find teacher details
          const matchingTeacher = teachers.find(t => t.id === teacher || t._id === teacher);
          if (matchingTeacher) {
            teacherOptions.push({
              value: matchingTeacher.id || matchingTeacher._id || teacher,
              label: `${matchingTeacher.firstName || ''} ${matchingTeacher.lastName || ''}`.trim(),
              email: matchingTeacher.email
            });
          }
        } else if (typeof teacher === 'object' && teacher !== null) {
          // Teacher object with id and name
          teacherOptions.push({
            value: teacher.id || '',
            label: teacher.name || '',
            email: teacher.email || ''
          });
        }
      });
    }
    
    console.log("Teacher options for edit:", teacherOptions);
    
      setFormData({
      primaryTeacherId: lesson.primaryTeacherId || '',
      teacherIds: teacherOptions,
      locationId: lesson.locationId || '',
      courseTypeId: lesson.courseTypeId || '',
        seasonId: lesson.seasonId || '',
      date: lesson.date || '',
      startTime: lesson.startTime || '',
      endTime: lesson.endTime || '',
      subject: lesson.subject || '',
      });
      
      setEditingId(lesson.id);
      setShowForm(true);
      
    // Add smooth scroll to form after a short delay
      setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
  };

  // Filter lessons for the current week view
  const currentWeekLessons = useMemo(() => {
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      console.log("No schedules available for filtering");
      return [];
    }
    
    console.log(`Filtering ${schedules.length} schedules for current week view`);
    
    const result = schedules
      .filter((schedule) => {
        if (!schedule || !schedule.date) return false;
        try {
          return isDateInWeek(schedule.date, weekDates);
        } catch (error: unknown) {
          console.error("Error parsing lesson date:", error);
          return false;
        }
      })
      .map(schedule => scheduleToLesson(schedule));
    
    console.log(`Found ${result.length} lessons for current week`);
    return result;
  }, [schedules, weekDates]);

  // Debug: Log when schedules change
  useEffect(() => {
    if (Array.isArray(schedules)) {
      console.log(`Schedule array updated with ${schedules.length} items`);
    }
  }, [schedules]);

  // Separate effect for initial data loading
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin') {
      // Load static data only once
      const loadInitialData = async () => {
        if (teachers.length === 0) await dispatch(fetchTeachers('active'));
        if (locations.length === 0) await dispatch(fetchLocations('active'));
        if (courseTypes.length === 0) await dispatch(fetchCourseTypes('active'));
        if (seasons.length === 0) await dispatch(fetchSeasons('active'));
        
        // Load leaves data too for the client-side check
        await dispatch(fetchLeaves());
      };
      
      loadInitialData();
    }
  }, [dispatch, isAuthenticated, user?.role, teachers.length, locations.length, courseTypes.length, seasons.length]); // Added dependency on collection lengths

  // Separate effect for schedule loading
  useEffect(() => {
    if (isAuthenticated && user?.role === 'admin' && dateParams.startDate && dateParams.endDate) {
      console.log("Fetching schedules with params:", dateParams);
      
      dispatch(fetchSchedules(dateParams))
        .unwrap()
        .then((result) => {
          // Access the schedules property of the result if it exists
          const fetchedSchedules = result?.schedules || [];
          console.log("Schedules fetched successfully:", fetchedSchedules.length, "lessons");
          setConnectionIssue(false);
        })
        .catch((err) => {
          console.error('Schedule loading error:', err);
          setConnectionIssue(true);
          showSnackbar('Dərs programı yüklənərkən xəta baş verdi...', 'error');
        });
    }
  }, [dispatch, isAuthenticated, user?.role, dateParams]); // Only depend on auth and date changes

  // Safe schedule refresh function to ensure data is properly loaded
  const safeRefreshSchedules = async () => {
    if (!isAuthenticated || user?.role !== 'admin') return;
    
    const dates = getCurrentWeekDates(currentWeekOffset);
    const params = {
      startDate: formatDateForAPI(dates[0]),
      endDate: formatDateForAPI(dates[6])
    };
    
    console.log("Safe refresh schedules with params:", params);
    
    try {
      // First attempt to load schedules
      const result = await dispatch(fetchSchedules(params)).unwrap();
      const fetchedSchedules = result?.schedules || [];
      
      // If no data or very few items returned, try again after a short delay
      if (!fetchedSchedules.length) {
        console.log("No schedules returned on first attempt, retrying...");
        
        // Wait a bit and try again
        await new Promise(resolve => setTimeout(resolve, 500));
        await dispatch(fetchSchedules(params)).unwrap();
      }
      
      setConnectionIssue(false);
    } catch (error) {
      console.error("Safe refresh schedules error:", error);
      setConnectionIssue(true);
      showSnackbar('Dərs programı yüklənərkən xəta baş verdi...', 'error');
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (confirm('Bu dərsi programdan silmek istediğinize əminsiniz?')) {
      try {
        await dispatch(deleteSchedule(id)).unwrap();
        setSelectedLesson(null);
        
        // Use safe refresh function instead of simple fetch
        await safeRefreshSchedules();
        
        // Show success message
        showSnackbar("Dərs ugurla silindi", "success");
      } catch (err: unknown) {
        console.error('Delete schedule failed:', err);
        if (err instanceof Error) {
          showSnackbar(err.message, "error");
        } else if (typeof err === 'string') {
          showSnackbar(err, "error");
        } else {
          showSnackbar("Silme işlemi başarısız oldu", "error");
        }
      }
    }
  };

  // Show lesson details when clicked
  const handleLessonClick = (lesson: Lesson) => {  
    setSelectedLesson(lesson);
  };

  // Close details modal
  const handleCloseDetails = () => {
    setSelectedLesson(null);
  };

  // Handle lesson duplication
  const handleDuplicateLesson = async (lesson: Lesson, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Original schedule to duplicate
      const originalSchedule = lesson;
      
      if (!originalSchedule.id) {
        showSnackbar('Ders ID bulunamadı', 'error');
        return;
      }
      
      // Add 10 minutes to the end time of the original lesson to get the start time for the new one
      const newStartTime = addMinutesToTime(originalSchedule.endTime, 10);
      
      // Calculate end time for new lesson (same duration as original)
      const startMinutes = timeToMinutes(originalSchedule.startTime);
      const endMinutes = timeToMinutes(originalSchedule.endTime);
      const durationMinutes = endMinutes - startMinutes;
      
      const newEndTimeMinutes = timeToMinutes(newStartTime) + durationMinutes;
      const newEndHours = Math.floor(newEndTimeMinutes / 60);
      const newEndMinutes = newEndTimeMinutes % 60;
      const newEndTime = `${newEndHours.toString().padStart(2, '0')}:${newEndMinutes.toString().padStart(2, '0')}`;
      
      // Extract all teacher IDs from the original lesson
      let allTeacherIds: string[] = [];
      
      // Handle different formats of teacherIds
      if (Array.isArray(originalSchedule.teacherIds)) {
        originalSchedule.teacherIds.forEach(teacher => {
          if (typeof teacher === 'string') {
            allTeacherIds.push(teacher);
          } else if (typeof teacher === 'object' && teacher !== null) {
            // Handle teacher object with id property
            if (teacher.id) {
              allTeacherIds.push(teacher.id);
            }
          }
        });
      }
      
      // Ensure primary teacher is included
      if (originalSchedule.primaryTeacherId && !allTeacherIds.includes(originalSchedule.primaryTeacherId)) {
        allTeacherIds.push(originalSchedule.primaryTeacherId);
      }
      
      // If no teachers found, use primary teacher as fallback
      if (allTeacherIds.length === 0 && originalSchedule.primaryTeacherId) {
        allTeacherIds = [originalSchedule.primaryTeacherId];
      }
      
      console.log('Duplicating lesson with teachers:', allTeacherIds);
      
      // Prepare new schedule data
      const newScheduleData: CreateScheduleRequest = {
        teacherIds: allTeacherIds,
        primaryTeacherId: originalSchedule.primaryTeacherId,
        locationId: originalSchedule.locationId,
        courseTypeId: originalSchedule.courseTypeId,
        seasonId: originalSchedule.seasonId || null,
        date: formatDateForAPI(new Date(originalSchedule.date)),
        startTime: newStartTime,
        endTime: newEndTime,
        subject: originalSchedule.subject || 'Dublicate: ' + (originalSchedule.subject || ''),
        teacherId: originalSchedule.primaryTeacherId
      };
      
      // Tüm gerekli alanların dolu olduğunu kontrol et
      const missingFields: string[] = [];
      Object.entries(newScheduleData).forEach(([key, value]) => {
        if (!value && key !== 'excludeLessonId') missingFields.push(key);
      });
      
      if (missingFields.length > 0) {
        console.error('Missing fields for duplicate lesson:', missingFields);
        showSnackbar(`Bazı alanlar eksik: ${missingFields.join(', ')}`, 'error');
        return;
      }
      
      
      // First check for teacher conflicts with the new time
      const conflictParams: TeacherConflictParams = {
        teacherIds: allTeacherIds,
        date: newScheduleData.date,
        startTime: newScheduleData.startTime,
        endTime: newScheduleData.endTime
      };
      
      const conflictResult = await dispatch(checkTeacherConflict(conflictParams)).unwrap();
      
      if (conflictResult.hasConflict) {
        showSnackbar(conflictResult.message || "Yeni zaman için çakışma tespit edildi.", 'error');
        return;
      }
      
      // FIXED: Now actually create the duplicate lesson
      const createResult = await dispatch(createSchedule(newScheduleData)).unwrap();
      console.log('Duplicate lesson created:', createResult);
      
      // Use safe refresh function instead of simple fetch
      await safeRefreshSchedules();
      
      // Close the details modal if it's open
      setSelectedLesson(null);
      
      // Show success message
      showSnackbar('Dərs uğurla kopyalandı ve əvvəlki dərsin bitiminden 10 dəqiqə sonraya yerləşdirildi', 'success');
    } catch (error: unknown) {
      console.error('Duplicate lesson error:', error);
      
      if (error instanceof Error) {
        showSnackbar(error.message, 'error');
      } else if (typeof error === 'string') {
        showSnackbar(error, 'error');
      } else {
        showSnackbar('Dərs kopyalanırken xəta baş verdi', 'error');
      }
    }
  };

  // Teacher selection handling
  const handleTeacherChange = (selectedOptions: readonly SelectOption[]) => {
    console.log("Selected teacher options:", selectedOptions);
    
    if (selectedOptions.length === 0) {
      setFormData({
        ...formData,
        teacherIds: [],
        primaryTeacherId: '',
      });
      return;
    }
    
    // Update teacherIds with selected options
    setFormData({
      ...formData,
      teacherIds: selectedOptions as SelectOption[],
      primaryTeacherId: formData.primaryTeacherId || selectedOptions[0]?.value || '',
    });
  };

  // Load teacher options for the select component
  const loadTeacherOptions = () => {
    return teachers.map(teacher => ({
      value: teacher.id || teacher._id || '',
      label: `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim(),
      email: teacher.email
    }));
  };

  // Add a retry function
  const handleRetryLoading = () => {
    if (dateParams.startDate && dateParams.endDate) {
      setConnectionIssue(false);
      dispatch(fetchSchedules(dateParams));
    }
  };

  // Add a reset form function
  const resetForm = () => {
    setFormData({
      teacherIds: [],
      primaryTeacherId: '',
      locationId: '',
      courseTypeId: '',
      seasonId: '',
      date: '',
      startTime: '',
      endTime: '',
      subject: ''
    });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Global styles for DatePicker */}
      <style jsx global>{`
        .react-datepicker-popper {
          z-index: 9999 !important;
        }
      `}</style>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Ders Programı</h1>
          <p className="text-gray-500">Həftəlik dərs programını əldə edin və idarə edin</p>
        </div>
        <div className="flex gap-2">
         
          <button
            onClick={() => {
              setFormData(emptyForm);
              setEditingId(null);
              setFormError(null);
              dispatch(resetScheduleError());
              dispatch(resetConflict());
              setShowForm(!showForm);
              setSelectedLesson(null);
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            disabled={isLoading}
          >
            <Plus size={16} />
            <span>Dərs əlavə et</span>
          </button>
        </div>
      </div>

      {/* Calendar navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <button 
          onClick={goToPreviousPeriod}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          disabled={isLoading}
        >
          <ChevronLeft size={20} />
          <span>Öncəki Həftə</span>
        </button>
        
        <div className="text-center">
          <h3 className="font-medium text-gray-800">
            {formatDate(weekDates[0])} - {formatDate(weekDates[weekDates.length - 1])}
          </h3>
          <div className="flex justify-center gap-4 mt-1">
            {currentWeekOffset !== 0 && (
              <button 
                onClick={goToCurrentPeriod}
                className="text-sm text-blue-600 hover:text-blue-800"
                disabled={isLoading}
              >
                Bugünə Qayıt
              </button>
            )}
            {isLoading && (
              <span className="text-sm text-gray-500 flex items-center">
                <Loader size={14} className="animate-spin mr-1" /> 
                Yüklənir...
              </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={goToNextPeriod}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          disabled={isLoading}
        >
          <span>Sonrakı Həftə</span>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Redux Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          
          {connectionIssue && (
            <div className="mt-2">
              <button 
                onClick={handleRetryLoading}
                className="flex items-center gap-1 text-red-700 hover:text-red-900 font-medium text-sm underline"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2v6h-6"></path>
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                  <path d="M3 22v-6h6"></path>
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                </svg>
                <span>Yenidən cəhd edin</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Lesson Form */}
      {showForm && (
        <div ref={formRef} className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-black">
            {editingId ? 'Dersi Düzəliş Et' : 'Programa Ders Əlavə Et'}
          </h2>
          
          {formError && (
            <div className="mb-4 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-800">
              <p>{formError}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="seasonId" className="block text-sm font-medium text-gray-700">
                Kurs <span className="text-xs text-gray-500">(Sadəcə aktif kurslar)</span>
              </label>
              <select
                id="seasonId"
                name="seasonId"
                value={formData.seasonId}
                onChange={(e) => {
                  handleChange(e);
                  // Seçilen sezonu logla
                }}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                disabled={isLoading}
              >
                <option value="">Kurs seçin</option>
                {seasons?.map((season, index) => {
                  const seasonId = season.id || season._id || '';
                  const seasonName = season.name || 'Adsız kurs';
                  return (
                    <option key={season.id || season._id || `season-${index}`} value={seasonId}>
                      {seasonName}
                    </option>
                  );
                })}
              </select>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="teachers" className="block text-sm font-medium text-gray-700">
                  Müəllimlər <span className="text-xs text-gray-500">(Sadəcə aktiv müəllimlər)</span>
                </label>
                <Select<SelectOption, true>
                  isMulti
                  id="teacherIds"
                  name="teacherIds"
                  value={formData.teacherIds as readonly SelectOption[]}
                  onChange={handleTeacherChange}
                  options={loadTeacherOptions() as readonly SelectOption[]}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm "
                  classNamePrefix="select"
                  isDisabled={isLoading}
                  placeholder="Müəllim seçin..."
                  noOptionsMessage={() => "Müəllim tapılmadı"}
                  loadingMessage={() => "Yüklənir..."}
                  menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                  styles={{
                    control: (base) => ({
                      ...base,
                      backgroundColor: 'white',
                      borderColor: '#D1D5DB',
                      minHeight: '42px',
                      boxShadow: 'none'
                    }),
                    menu: (base) => ({
                      ...base,
                      zIndex: 9999
                    }),
                    menuPortal: (base) => ({
                      ...base,
                      zIndex: 9999
                    }),
                    option: (base) => ({
                      ...base,
                      color: 'black'
                    }),
                    multiValue: (base) => ({
                      ...base,
                      backgroundColor: '#EBF5FF',
                      color: 'black'
                    }),
                    multiValueLabel: (base) => ({
                      ...base,
                      color: 'black',
                      fontWeight: 500
                    }),
                    placeholder: (base) => ({
                      ...base,
                      color: '#6B7280'
                    }),
                    singleValue: (base) => ({
                      ...base,
                      color: 'black'
                    }),
                    input: (base) => ({
                      ...base,
                      color: 'black'
                    })
                  }}
                />
                <p className="mt-1 text-sm text-gray-500">Birden fazla seçim yapabilirsiniz</p>
              </div>
              
              <div>
                <label htmlFor="locationId" className="block text-sm font-medium text-gray-700">
                  Yer <span className="text-xs text-gray-500">(Sadəcə aktif yerlər)</span>
                </label>
                <select
                  id="locationId"
                  name="locationId"
                  value={formData.locationId}
                  onChange={(e) => {
                    handleChange(e);
                  }}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                  disabled={isLoading}
                >
                  <option value="">Yer seçin</option>
                  {locations?.map((location, index) => {
                    const locationId = location.id || location._id || '';
                    const locationName = location.name || 'İsimsiz yer';
                    return (
                      <option key={location.id || location._id || `location-${index}`} value={locationId}>
                        {locationName}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            
            <div>
              <label htmlFor="courseTypeId" className="block text-sm font-medium text-gray-700">
                Dərs Tipi <span className="text-xs text-gray-500">(Sadəcə aktif dərs tipləri)</span>
              </label>
              <select
                id="courseTypeId"
                name="courseTypeId"
                value={formData.courseTypeId}
                onChange={(e) => {
                  handleChange(e);
                }}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                disabled={isLoading}
              >
                <option value="">Dərs tipi seçin</option>
                {courseTypes?.map((courseType, index) => {
                  const courseTypeId = courseType.id || courseType._id || '';
                  const courseTypeName = courseType.name || 'İsimsiz tipi';
                  return (
                    <option key={courseType.id || courseType._id || `course-type-${index}`} value={courseTypeId}>
                      {courseTypeName}
                    </option>
                  );
                })}
              </select>
            </div>
            
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Tarix
              </label>
              <div className="mt-1">
                <style>{customDatePickerStyles}</style>
                <DatePicker
                  selected={typeof formData.date === 'string' ? new Date(formData.date) : formData.date}
                  onChange={(date: Date | null) => handleChange(null, 'date', date || new Date())}
                  dateFormat="dd.MM.yyyy"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                  disabled={isLoading}
                  placeholderText="Tarix seçin"
                  locale="tr"
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">
                  Başlanğıç Saatı
                </label>
                <input
                  type="time"
                  id="startTime"
                  name="startTime"
                  value={formData.startTime}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">
                  Bitiş Saatı
                </label>
                <input
                  type="time"
                  id="endTime"
                  name="endTime"
                  value={formData.endTime}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="md:col-span-2">
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                Mövzu
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                required
                className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                disabled={isLoading}
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                  dispatch(resetScheduleError());
                  dispatch(resetConflict());
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                disabled={isLoading}
              >
                Ləğv Et
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <Loader size={16} className="mr-2 animate-spin" />
                    {editingId ? 'Düzəliş Edilir...' : 'Əlavə Edilir...'}
                  </span>
                ) : (
                  editingId ? 'Düzəliş Et' : 'Əlavə Et'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lesson Details Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center h-screen bg-opacity-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-slate-800">Dərs Detalları</h3>
              <button
                onClick={handleCloseDetails}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Subject header with color background */}
              <div className="rounded-md bg-blue-50 p-4 border-l-4 border-blue-500">
                <h4 className="font-bold text-blue-700 text-lg">{selectedLesson.subject}</h4>
              </div>
              
              {/* Date and Time badges */}
              <div className="flex flex-wrap gap-2 mb-2">
                <div className="flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
                  <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                  <span>
                    {new Date(selectedLesson.date).toLocaleDateString('tr-TR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </span>
                </div>
                
                <div className="flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
                  <Clock className="mr-2 h-4 w-4 text-gray-500" />
                  <span>{selectedLesson.startTime} - {selectedLesson.endTime}</span>
                </div>
              </div>
              
              {/* Details grid */}
              <div className="grid grid-cols-1 gap-4 bg-gray-50 rounded-lg p-4">
                {/* Kurs - Full width */}
                <div className="bg-white rounded-md p-3 shadow-sm">
                  <div className="text-xs font-medium uppercase text-gray-500 mb-1">Kurs</div>
                  <div className="flex items-center">
                    <CalendarRange className="mr-2 h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium text-gray-800">{selectedLesson.seasonName || 'Kurs seçilməyib'}</span>
                  </div>
                </div>
                
                {/* Müəllim - Full width */}
                <div className="bg-white rounded-md p-3 shadow-sm">
                  <div className="text-xs font-medium uppercase text-gray-500 mb-1">Müəllimlər</div>
                  <div className="flex flex-col">
                      {(() => {
                      // Get all teachers
                      const displayedTeachers: React.ReactNode[] = [];
                      
                      // Track added teacher IDs to avoid duplicates
                      const addedTeacherIds = new Set<string>();
                      
                      // Handle different ways teachers might be represented
                      if (Array.isArray(selectedLesson.teacherIds)) {
                        selectedLesson.teacherIds.forEach((teacher) => {
                          if (typeof teacher === 'object' && teacher !== null) {
                            // Teacher is an object with properties
                            const teacherId = teacher.id || '';
                            if (!addedTeacherIds.has(teacherId) && teacherId) {
                              addedTeacherIds.add(teacherId);
                              displayedTeachers.push(
                                <div key={teacherId} className="flex items-center mb-1">
                                  <User className="mr-2 h-4 w-4 text-gray-500" />
                                  <span className="text-sm font-medium text-gray-800">{teacher.name}</span>
                                </div>
                              );
                            }
                          } else if (typeof teacher === 'string') {
                            // Teacher is just an ID string
                            if (!addedTeacherIds.has(teacher)) {
                              addedTeacherIds.add(teacher);
                        
                        const matchingTeacher = teachers.find((t: Teacher) => 
                                t.id === teacher || t._id === teacher
                              );
                              
                              if (matchingTeacher) {
                                displayedTeachers.push(
                                  <div key={teacher} className="flex items-center mb-1">
                                    <User className="mr-2 h-4 w-4 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-800">
                                      {matchingTeacher.firstName} {matchingTeacher.lastName}
                                    </span>
                                  </div>
                                );
                              } else {
                                displayedTeachers.push(
                                  <div key={teacher} className="flex items-center mb-1">
                                    <User className="mr-2 h-4 w-4 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-800">Naməlum müəllim (ID: {teacher.substring(0, 8)}...)</span>
                                  </div>
                                );
                              }
                            }
                          }
                        });
                      }
                      
                      // Add primary teacher if not already in the list
                      if (selectedLesson.primaryTeacherId && !addedTeacherIds.has(selectedLesson.primaryTeacherId)) {
                        const primaryTeacher = teachers.find((t: Teacher) => 
                          t.id === selectedLesson.primaryTeacherId || t._id === selectedLesson.primaryTeacherId
                        );
                        
                        if (primaryTeacher) {
                          const teacherId = primaryTeacher.id || primaryTeacher._id || '';
                          displayedTeachers.push(
                            <div key={teacherId} className="flex items-center mb-1">
                              <User className="mr-2 h-4 w-4 text-black" />
                              <span className="text-sm font-medium text-black">
                                {primaryTeacher.firstName} {primaryTeacher.lastName}
                              </span>
                            </div>
                          );
                        }
                        }
                        
                      return displayedTeachers.length > 0 
                        ? displayedTeachers 
                        : <div className="flex items-center">
                            <User className="mr-2 h-5 w-5 text-gray-500" />
                            <span className="text-sm font-medium text-gray-800">Müəllim təyin edilməyib</span>
                          </div>;
                      })()}
                  </div>
                </div>
                
                {/* Yer and Dərs Tipi - Two columns */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-md p-3 shadow-sm">
                    <div className="text-xs font-medium uppercase text-gray-500 mb-1">Yer</div>
                    <div className="flex items-center">
                      <MapPin className="mr-2 h-5 w-5 text-red-500" />
                      <span className="text-sm font-medium text-gray-800">{selectedLesson.locationName}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-md p-3 shadow-sm">
                    <div className="text-xs font-medium uppercase text-gray-500 mb-1">Dərs Tipi</div>
                    <div className="flex items-center">
                      <div className={`h-5 w-5 rounded-full mr-2 flex items-center justify-center ${
                        selectedLesson.type === 'lecture' ? 'bg-green-100 text-green-600' :
                        selectedLesson.type === 'practice' ? 'bg-yellow-100 text-yellow-600' :
                        selectedLesson.type === 'exam' ? 'bg-red-100 text-red-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <BookOpen size={12} />
                      </div>
                      <span className="text-sm font-medium text-gray-800">{selectedLesson.type}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Status indicator */}
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center">
                  {selectedLesson.isChecked ? (
                    <div className="flex items-center text-green-600">
                      <div className="bg-green-100 p-1 rounded-full mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <span className="text-sm font-medium">Yoxlanılmış dərs</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-500">
                      <div className="bg-gray-100 p-1 rounded-full mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                      </div>
                      <span className="text-sm font-medium">Yoxlanılmamış dərs</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    handleDuplicateLesson(selectedLesson, new Event('click') as unknown as React.MouseEvent);
                    handleCloseDetails();
                  }}
                  className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  title="10 dəqiqə sonrasına kopyala"
                >
                  Dublikat
                </button>
                
                
                
                <button
                  onClick={() => {
                    handleEdit(selectedLesson);
                    handleCloseDetails();
                  }}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Düzəliş Et
                </button>
                
                <button
                  onClick={() => {
                    handleDelete(selectedLesson.id);
                    handleCloseDetails();
                  }}
                  className="rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <Loader size={30} className="animate-spin text-blue-500" />
          <span className="ml-2 text-lg">Dərs programı yüklənir...</span>
        </div>
      )}

      {/* Failed Loading State */}
      {!isLoading && error && connectionIssue && (
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-md">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <path d="M18 6L6 18M6 6l12 12"></path>
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-red-800">Serverlə əlaqə problemi</h3>
          <p className="text-gray-600 mb-4">Dərs programını yükləmək mümkün olmadı. Server xətası baş verdi.</p>
          
          <button 
            onClick={handleRetryLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 inline-flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
            <span>Yenidən cəhd edin</span>
          </button>
        </div>
      )}

      {/* Weekly Schedule Grid View */}
      {!isLoading && !connectionIssue && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-md overflow-x-auto">
        <div className="min-w-[900px]">
            {/* Hours header - Made sticky */}
            <div className="sticky top-0 z-30">
              <div className="flex border-b border-gray-200 bg-white shadow-sm">
                <div className="w-44 shrink-0 border-r border-gray-200 bg-blue-50 p-3 font-medium text-blue-900">
              Gün / Tarix
            </div>
                <div className="relative flex-grow p-3">
              <div className="flex justify-between px-2">
                {hourLabels.map((hour, index) => (
                      <div key={index} className="text-xs font-medium text-gray-600">
                    {hour}
                  </div>
                ))}
                  </div>
              </div>
            </div>
          </div>
          
          {/* Days and schedule */}
            <div className="relative">
          {weekDates.map((date, dateIndex) => {
            const dayOfWeek = date.getDay();
            const fullDate = formatDate(date);
            const dateString = formatDateForComparison(date);
            
            // Check if we have any lessons for this day
                const lessonsForDay = currentWeekLessons.filter(lesson => {
              if (lesson.date) {
                const lessonDate = new Date(lesson.date);
                return formatDateForComparison(lessonDate) === dateString;
              }
              return false;
            });
                
                const hasLessonsForDay = lessonsForDay.length > 0;
                
                // Is it weekend?
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                // Find max number of lesson overlaps to determine row height
                let maxOverlapCount = 0;
                
                if (lessonsForDay.length > 0) {
                  // Sort lessons by start time for efficient overlap calculation
                  const sortedLessons = [...lessonsForDay].sort((a, b) => {
                    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
                  });
                  
                  // For each lesson, count how many other lessons it overlaps with
                  sortedLessons.forEach((lesson, idx) => {
                    // Start with this lesson in the active set
                    let activeOverlaps = 1;
                    
                    // Look at all subsequent lessons to see if they overlap
                    for (let j = idx + 1; j < sortedLessons.length; j++) {
                      const nextLesson = sortedLessons[j];
                      
                      // If next lesson starts after current lesson ends, there's no overlap
                      if (timeToMinutes(nextLesson.startTime) >= timeToMinutes(lesson.endTime)) {
                        break;
                      }
                      
                      // There is an overlap
                      activeOverlaps++;
                    }
                    
                    // Update max overlap count
                    maxOverlapCount = Math.max(maxOverlapCount, activeOverlaps);
                  });
                }

                // Pre-assign tracks to teachers for consistency
                const teacherTrackMap = new Map<string, number>();
                let nextAvailableTrack = 0;
                
                // Calculate dynamic row height based on overlaps only
                const heightPerLesson = 60; // pixels
                const baseHeight = 160; // pixels (10rem)
                
                // Add extra padding to the calculated height for better spacing
                const dynamicHeight = maxOverlapCount > 0 
                  ? Math.max(baseHeight, maxOverlapCount * heightPerLesson + 20) 
                  : baseHeight;
            
            return (
                  <div key={dateIndex} className={`flex border-b border-gray-200 ${isWeekend ? 'bg-gray-50' : ''}`}>
                    <div className={`flex w-44 shrink-0 items-center border-r border-gray-200 p-3 ${isWeekend ? 'bg-gray-100' : ''}`}>
                  <div>
                        <p className="font-medium text-gray-800">{formatDayName(date)}</p>
                    <p className="text-xs text-gray-500">{fullDate}</p>
                    {!hasLessonsForDay && (
                          <p className="text-xs mt-1 text-blue-600 font-medium">
                        Bu tarix üçün dərs yoxdur
                      </p>
                    )}
                  </div>
                </div>
                    <div 
                      className="relative flex-grow p-2"
                      style={{ height: `${dynamicHeight}px` }}
                    >
                  {/* Hour grid lines */}
                  <div className="absolute inset-0">
                    <div className="flex h-full justify-between">
                      {hourLabels.map((_, index) => (
                        <div key={index} className="h-full w-px bg-gray-100"></div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Lessons */}
                      {lessonsForDay
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((lesson, lessonIndex, filteredLessons) => {
                      const { left, width } = calculateGridPosition(lesson.startTime, lesson.endTime);
                      
                      // Find all lessons that overlap with this one
                      const overlappingLessons = filteredLessons.filter(otherLesson => 
                        lesson.id !== otherLesson.id && checkOverlap(lesson, otherLesson)
                      );
                      
                      // Get primary teacher ID for track consistency
                      const primaryTeacherId = lesson.primaryTeacherId || '';
                      let trackToUse = 0;
                      
                      // Create array to track occupied vertical positions/tracks
                      const maxPossibleTracks = Math.max(10, maxOverlapCount * 2);
                      const occupiedTracks = new Array(maxPossibleTracks).fill(false);
                      
                      // Mark tracks as occupied based on lessons that overlap with current lesson
                      overlappingLessons.forEach(overlap => {
                        if (filteredLessons.findIndex(l => l.id === overlap.id) < lessonIndex) {
                          const overlapTrack = filteredLessons
                            .filter((_, idx) => idx < lessonIndex)
                            .find(l => l.id === overlap.id)?.track;
                          
                          if (overlapTrack !== undefined && overlapTrack < occupiedTracks.length) {
                            occupiedTracks[overlapTrack] = true;
                          }
                        }
                      });
                      
                      // Check if this teacher already has an assigned track
                      if (teacherTrackMap.has(primaryTeacherId)) {
                        const preferredTrack = teacherTrackMap.get(primaryTeacherId) || 0;
                        
                        // If the preferred track is available, use it
                        if (!occupiedTracks[preferredTrack]) {
                          trackToUse = preferredTrack;
                        } else {
                          // Find another available track
                          let track = 0;
                          while (track < occupiedTracks.length && occupiedTracks[track]) {
                            track++;
                          }
                          trackToUse = track;
                        }
                      } else {
                        // This teacher doesn't have a track yet
                        // Try to find a free track starting from nextAvailableTrack
                        let track = nextAvailableTrack;
                        while (track < occupiedTracks.length && occupiedTracks[track]) {
                          track++;
                        }
                        
                        trackToUse = track;
                        teacherTrackMap.set(primaryTeacherId, track);
                        nextAvailableTrack = track + 1;
                      }
                      
                      // Store the track on the lesson object
                      lesson.track = trackToUse;
                      
                      // Calculate top position based on track
                      const topOffset = trackToUse * heightPerLesson;
                      
                      return (
                        <div
                          key={lesson.id}
                          className={`absolute rounded-md py-1 mt-1 px-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 ${getTypeColor(lesson.type)}`}
                          style={{ 
                            left, 
                            width, 
                            top: `${topOffset}px`,
                            height: `${heightPerLesson - 2}px`,
                            zIndex: trackToUse + 1,
                          }}
                          onClick={() => handleLessonClick(lesson)}
                        >
                              <div className="relative overflow-hidden text-xs">
                            {/* Duplicate button */}
                            <button 
                              className="absolute right-0 top-0 bg-white rounded-full p-1 shadow-sm hover:bg-blue-100 transition-colors"
                              onClick={(e) => handleDuplicateLesson(lesson, e)}
                              title="Dərsi kopyala (bitişindən 10 dəqiqə sonra)"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" 
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
                                className="text-blue-600">
                                <rect x="8" y="8" width="12" height="12" rx="2" ry="2"></rect>
                                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
                              </svg>
                            </button>
                            
                            {/* Check mark indicator for verified lessons */}
                            {lesson.isChecked && (
                                  <div className="absolute z-10 right-0 bottom-0 bg-green-500 rounded-full p-0.5" title="Yoxlanılmış dərs">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" 
                                  stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              </div>
                            )}
                            
                            <div className="font-bold truncate">{lesson.subject}</div>
                            <div className="truncate font-medium">
                              {(() => {
                                    // First check for primaryTeacherName
                                if (lesson.primaryTeacherName) {
                                  return lesson.primaryTeacherName;
                                }
                                
                                    // Then check for teacherIds array
                                    if (Array.isArray(lesson.teacherIds) && lesson.teacherIds.length > 0) {
                                      const firstTeacher = lesson.teacherIds[0];
                                      if (typeof firstTeacher === 'object' && firstTeacher !== null && firstTeacher.name) {
                                        return firstTeacher.name;
                                      }
                                }
                                
                                // Finally check in Redux store
                                const matchingTeacher = teachers.find((t: Teacher) => 
                                  t.id === lesson.primaryTeacherId || t._id === lesson.primaryTeacherId
                                );
                                
                                if (matchingTeacher?.firstName && matchingTeacher?.lastName) {
                                  return `${matchingTeacher.firstName} ${matchingTeacher.lastName}`;
                                }
                                
                                return 'Müəllim seçilmədi';
                              })()}
                            </div>
                            <div className="truncate opacity-75">{lesson.startTime}-{lesson.endTime}</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
        </div>
      )}

      {/* Snackbar notification */}
      {snackbar.open && (
        <div className={`fixed bottom-4 right-4 z-50 max-w-md rounded-lg p-4 shadow-lg flex items-center justify-between ${
          snackbar.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 
          snackbar.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 
          'bg-blue-100 text-blue-800 border border-blue-200'
        }`}>
          <div className="flex items-center">
            {snackbar.type === 'success' && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {snackbar.type === 'error' && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293-1.293a1 1 0 00-1.414-1.414L10 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            {snackbar.type === 'info' && (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <p>{snackbar.message}</p>
          </div>
          <button 
            onClick={closeSnackbar} 
            className="ml-4 text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
} 