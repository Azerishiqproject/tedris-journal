'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, Clock, MapPin, User, BookOpen, Plus, Edit, Trash, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
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
import { fetchCourses } from '@/redux/slices/courseSlice';
import { fetchLocations } from '@/redux/slices/locationSlice';
import { fetchCourseTypes } from '@/redux/slices/courseTypeSlice';
import DatePicker from "react-datepicker";
import { registerLocale, setDefaultLocale } from "react-datepicker";
import { tr } from 'date-fns/locale';
import "react-datepicker/dist/react-datepicker.css";

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
const emptyForm = {
  courseId: '',
  teacherId: '',
  locationId: '',
  courseTypeId: '',
  date: new Date(),
  startTime: '09:00',
  endTime: '11:00',
  subject: ''
};

// Update Lesson interface
interface Schedule {
  id: string;
  courseId: string;
  teacherId: string;
  locationId: string;
  courseTypeId: string;
  date: string;
  startTime: string;
  endTime: string;
  subject?: string;
  courseName?: string;
  locationName?: string;
  teacherName?: string;
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
const scheduleToLesson = (schedule: Schedule): Lesson => {
  return {
    ...schedule,
    teacher: undefined // Will be populated when needed
  };
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

export default function SchedulePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  
  // Form ref for scrolling
  const formRef = useRef<HTMLDivElement>(null);
  
  // Redux state'leri
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { schedules, isLoading, error, conflict } = useAppSelector((state) => state.schedules);
  const { courses } = useAppSelector((state) => state.courses);
  const { teachers } = useAppSelector((state) => state.teachers);
  const { locations } = useAppSelector((state) => state.locations);
  const { courseTypes } = useAppSelector((state) => state.courseTypes);
  
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
  
  // Debug log mounts/updates for all state values
  useEffect(() => {
    console.log('SchedulePage data status update:');
    console.log('- Auth:', { isAuthenticated, userRole: user?.role, userEmail: user?.email });
    console.log('- Schedule data:', { 
      count: schedules?.length || 0,
      isLoading, 
      hasError: !!error,
      hasConflict: !!conflict
    });
    
    // Form seçenekleri için veri durumunu log edelim
    console.log('- Form options:', {
      courses: courses?.length || 0,
      teachers: teachers?.length || 0,
      locations: locations?.length || 0,
      courseTypes: courseTypes?.length || 0
    });
  }, [
    schedules, isLoading, error, conflict, 
    courses, teachers, locations, courseTypes, 
    user, isAuthenticated
  ]);
  
  // Admin yetkisi kontrolü
  useEffect(() => {
    if (user && user.role !== 'admin') {
      console.log('Non-admin user detected, redirecting');
      router.push('/');
    } else if (!isAuthenticated) {
      console.log('User not authenticated, redirecting to login');
      router.push('/login');
    } else {
      console.log('Admin user confirmed:', user?.email);
    }
  }, [user, isAuthenticated, router]);
  
  // Çakışma hatası durumunda form hatasını güncelle
  useEffect(() => {
    if (conflict?.hasConflict) {
      setFormError(conflict.message || 'Programda çakışma tespit edildi. Lütfen başka bir saat seçin.');
    }
  }, [conflict]);
  
  // Get current week dates but start from the fixed reference week in April 2025
  const getCurrentWeekDates = () => {
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
    startOfWeek.setDate(startOfWeek.getDate() + (currentWeekOffset * 7));
    
    // Generate days for the week (Monday to Sunday)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date;
    });
  };
  
  // Combine the date calculations into a single useMemo
  const { weekDates, dateParams } = useMemo(() => {
    // Calculate week dates
    const dates = getCurrentWeekDates();
    
    // Calculate API parameters
    const params = {
      startDate: formatDateForAPI(dates[0]),
      endDate: formatDateForAPI(dates[6])
    };
    
    return { weekDates: dates, dateParams: params };
  }, [currentWeekOffset]);
  
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
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | null,
    field?: string,
    value?: unknown
  ) => {
    if (e) {
      // Normal form elemanları için
      const { name, value: inputValue } = e.target;
      setFormData((prev) => ({ ...prev, [name]: inputValue }));
    } else if (field && value !== undefined) {
      // DatePicker gibi özel bileşenler için
      setFormData((prev) => ({ ...prev, [field]: value }));
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
    
    // Validation
    if (!formData.courseId || !formData.courseTypeId || !formData.teacherId || !formData.date || !formData.startTime || !formData.endTime || !formData.locationId) {
      setFormError("Tüm alanları doldurun.");
      return;
    }
    
    const startMinutes = timeToMinutes(formData.startTime);
    const endMinutes = timeToMinutes(formData.endTime);
    
    if (startMinutes >= endMinutes) {
      setFormError("Bitiş saati başlangıç saatinden sonra olmalıdır");
      return;
    }
    
    try {
      // 1. Önce öğretmenin izinde olup olmadığını kontrol et
      const leaveParams = {
        teacherId: formData.teacherId,
        date: formatDateForAPI(new Date(formData.date))
      };
      
      // Call the API to check for teacher leave
      const leaveResult = await dispatch(checkTeacherLeave(leaveParams)).unwrap();
      
      // If teacher is on leave, show error and stop
      if (leaveResult.hasLeave) {
        setFormError(leaveResult.message || "Bu təqvim tarixində müəllim izinlidir və dərs programlanamaz.");
        return;
      }
      
      // 2. Sonra öğretmenin başka dersi olup olmadığını kontrol et
      const conflictParams = {
        teacherId: formData.teacherId,
        date: formatDateForAPI(new Date(formData.date)),
        startTime: formData.startTime,
        endTime: formData.endTime,
        excludeLessonId: editingId || undefined
      };
      
      // Call the API to check for conflicts
      const conflictResult = await dispatch(checkTeacherConflict(conflictParams)).unwrap();
      
      // If there's a conflict, show the error and stop
      if (conflictResult.hasConflict) {
        setFormError(conflictResult.message || "Müəllim üçün üst-üstə düşən dərs tapıldı.");
        return;
      }
      
      // Log for debug
      console.log('Form data being submitted:', formData);
      
      if (editingId) {
        // Update existing lesson
        await dispatch(updateSchedule({ 
          id: editingId, 
          scheduleData: {
            courseId: formData.courseId,
            teacherId: formData.teacherId,
            locationId: formData.locationId,
            courseTypeId: formData.courseTypeId,
            date: formatDateForAPI(new Date(formData.date)),
            startTime: formData.startTime,
            endTime: formData.endTime,
            subject: formData.subject
          }
        })).unwrap();
        
        // Success - reset form and fetch updated data
        setFormData(emptyForm);
        setShowForm(false);
        setEditingId(null);
        
        // Yenileme
        dispatch(fetchSchedules(dateParams));
        
        showSnackbar('Dərs ugurla yenilendi.', 'success');
      } else {
        // Create new lesson
        await dispatch(createSchedule({
          courseId: formData.courseId,
          teacherId: formData.teacherId,
          locationId: formData.locationId,
          courseTypeId: formData.courseTypeId,
          date: formatDateForAPI(new Date(formData.date)),
          startTime: formData.startTime,
          endTime: formData.endTime,
          subject: formData.subject
        })).unwrap();
        
        // Success - reset form and fetch updated data
        setFormData(emptyForm);
        setShowForm(false);
        
        // Yenileme
        dispatch(fetchSchedules(dateParams));
        
        showSnackbar('Yeni dərs ugurla əlavə edildi.', 'success');
      }
      
      // Clear selected lesson
      setSelectedLesson(null);
    } catch (error: unknown) {
      console.error('Lesson save error:', error);
      
      if (error instanceof Error) {
        setFormError(error.message);
      } else if (typeof error === 'string') {
        setFormError(error);
      } else {
        setFormError('Dərs saxlanılırken bir xəta baş verdi.');
      }
    }
  };

  // Handle edit
  const handleEdit = (lesson: Lesson) => {
    let lessonDate = new Date();
    
    if (lesson.date) {
      lessonDate = new Date(lesson.date);
    }
    
    setFormData({
      courseId: lesson.courseId,
      teacherId: lesson.teacherId,
      locationId: lesson.locationId,
      courseTypeId: lesson.courseTypeId || '',
      date: lessonDate,
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      subject: lesson.subject || ''
    });
    
    setEditingId(lesson.id);
    setShowForm(true);
    setFormError(null);
    dispatch(resetScheduleError());
    dispatch(resetConflict());
    setSelectedLesson(null);
    
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  // Fetch schedule data when week changes
  useEffect(() => {
    if (user && user.role === 'admin' && isAuthenticated) {
      console.log(`Fetching schedules for week: ${dateParams.startDate} to ${dateParams.endDate}`);
      
      dispatch(fetchSchedules(dateParams));
      
      if (courses.length === 0) dispatch(fetchCourses('active'));
      if (teachers.length === 0) dispatch(fetchTeachers('active'));
      if (locations.length === 0) dispatch(fetchLocations('active'));
      if (courseTypes.length === 0) dispatch(fetchCourseTypes('active'));
    }
  }, [
    dispatch, 
    user, 
    isAuthenticated, 
    dateParams, 
    courses.length, 
    teachers.length, 
    locations.length, 
    courseTypes.length
  ]);

  // Handle delete
  const handleDelete = async (id: string) => {
    if (confirm('Bu dərsi programdan silmek istediğinize əminsiniz?')) {
      try {
        await dispatch(deleteSchedule(id)).unwrap();
        setSelectedLesson(null);
        
        // Fetch the current week data after delete
        dispatch(fetchSchedules(dateParams));
        
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
    console.log("Seçilen dərs detayları:", lesson);
    console.log("Müəllim bilgisi:", lesson.teacherName);
    
    console.log("Müəllim ID:", lesson.teacherId);
    console.log("Dərsin bütün xüsusiyyətləri:", Object.keys(lesson));
    
    if (lesson.teacher) {
      console.log("Referans müəllim objesi:", lesson.teacher);
    }
    
    const matchingTeacher = teachers.find(t => 
      t.id === lesson.teacherId || t._id === lesson.teacherId
    );
    
    if (matchingTeacher) {
      console.log("Redux'ta bulunan eşleşen müəllim:", matchingTeacher);
    } else {
      console.log("Redux'ta bu ID'ye sahip müəllim bulunamadı:", lesson.teacherId);
    }
    
    setSelectedLesson(lesson);
  };

  // Close details modal
  const handleCloseDetails = () => {
    setSelectedLesson(null);
  };

  // Filter lessons for the current week view
  const currentWeekLessons = schedules.filter((schedule: Schedule) => {
    if (!schedule.date) return false;
    return isDateInWeek(schedule.date, weekDates);
  }).map(scheduleToLesson);

  // Handle duplicate lesson işlevini güncelliyorum
  const handleDuplicateLesson = async (lesson: Lesson, e: React.MouseEvent) => {
    // Stop event from propagating to parent elements
    e.stopPropagation();
    
    try {
      // Dersin tam verilerini Redux store'dan al
      const originalSchedule = schedules.find(s => s.id === lesson.id);
      
      if (!originalSchedule) {
        showSnackbar('Kopyalanacak ders bulunamadı. Lütfen sayfayı yenileyip tekrar deneyin.', 'error');
        return;
      }
      
      // Dersin süresini hesapla
      const startMinutes = timeToMinutes(originalSchedule.startTime);
      const endMinutes = timeToMinutes(originalSchedule.endTime);
      const lessonDuration = endMinutes - startMinutes;
      
      // Yeni başlangıç saati (orijinal dersin bitiş saatinden 10 dakika sonra)
      const newStartTime = addMinutesToTime(originalSchedule.endTime, 10);
      
      // Yeni bitiş saati (yeni başlangıç + orijinal süre)
      const newStartMinutes = timeToMinutes(newStartTime);
      const newEndMinutes = newStartMinutes + lessonDuration;
      const newEndTime = `${Math.floor(newEndMinutes / 60).toString().padStart(2, '0')}:${(newEndMinutes % 60).toString().padStart(2, '0')}`;
      
      console.log(`Original lesson: ${originalSchedule.startTime}-${originalSchedule.endTime}, duration: ${lessonDuration} minutes`);
      console.log(`New lesson: ${newStartTime}-${newEndTime}, starts 10 minutes after original lesson ends`);
      
      // Backend'in beklediği tüm alanları içeren veri objesi oluştur
      const newScheduleData = {
        courseId: originalSchedule.courseId,
        teacherId: originalSchedule.teacherId,
        locationId: originalSchedule.locationId,
        courseTypeId: originalSchedule.courseTypeId,
        date: formatDateForAPI(new Date(originalSchedule.date)),
        startTime: newStartTime,
        endTime: newEndTime,
        subject: originalSchedule.subject || 'Dublicate: ' + (originalSchedule.subject || '')
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
      
      console.log('Duplicating lesson with data:', newScheduleData);
      
      // First check for teacher conflicts with the new time
      const conflictParams = {
        teacherId: newScheduleData.teacherId,
        date: newScheduleData.date,
        startTime: newScheduleData.startTime,
        endTime: newScheduleData.endTime
      };
      
      const conflictResult = await dispatch(checkTeacherConflict(conflictParams)).unwrap();
      
      if (conflictResult.hasConflict) {
        showSnackbar(conflictResult.message || "Yeni zaman için çakışma tespit edildi.", 'error');
        return;
      }
      
      // If no conflicts, create the new schedule
      const result = await dispatch(createSchedule(newScheduleData)).unwrap();
      console.log('Duplicate created successfully:', result);
      
      // Refresh the schedule data
      dispatch(fetchSchedules(dateParams));
      
      // Show success message
      showSnackbar('Dərs uğurla kopyalandı ve önceki dersin bitiminden 10 dəqiqə sonraya yerləşdirildi', 'success');
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
                Bugünə Dön
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="courseId" className="block text-sm font-medium text-gray-700">
                  Ders <span className="text-xs text-gray-500">(Sadəcə aktif derslər)</span>
                </label>
                <select
                  id="courseId"
                  name="courseId"
                  value={formData.courseId}
                  onChange={(e) => {
                    handleChange(e);
                    // Seçilen dersi logla
                    const selectedId = e.target.value;
                    const selectedCourse = courses?.find(c => (c.id === selectedId || c._id === selectedId));
                    console.log('Seçilen ders:', selectedCourse, 'ID:', selectedId);
                  }}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                  disabled={isLoading}
                >
                  <option value="">Ders seçin</option>
                  {courses?.map((course, index) => {
                    const courseId = course.id || course._id || '';
                    const courseName = course.name || 'İsimsiz ders';
                    console.log(`Ders option: ID=${courseId}, Name=${courseName}`);
                    return (
                      <option key={course.id || course._id || `course-${index}`} value={courseId}>
                        {courseName}
                      </option>
                    );
                  })}
                </select>
              </div>
              
              <div>
                <label htmlFor="teacherId" className="block text-sm font-medium text-gray-700">
                  Müəllim <span className="text-xs text-gray-500">(Sadəcə aktif müəllimlər)</span>
                </label>
                <select
                  id="teacherId"
                  name="teacherId"
                  value={formData.teacherId}
                  onChange={(e) => {
                    handleChange(e);
                    // Seçilen öğretmeni logla
                    const selectedId = e.target.value;
                    const selectedTeacher = teachers?.find(t => (t.id === selectedId || t._id === selectedId));
                    console.log('Seçilen müəllim:', selectedTeacher, 'ID:', selectedId);
                  }}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                  disabled={isLoading}
                >
                  <option value="">Müəllim seçin</option>
                  {teachers?.map((teacher, index) => {
                    const teacherId = teacher.id || teacher._id || '';
                    const teacherName = (teacher.firstName || '') + ' ' + (teacher.lastName || '');
                    console.log(`Müəllim option: ID=${teacherId}, Name=${teacherName}`);
                    return (
                      <option key={teacher.id || teacher._id || `teacher-${index}`} value={teacherId}>
                        {teacherName}
                      </option>
                    );
                  })}
                </select>
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
                    // Seçilen lokasyonu logla
                    const selectedId = e.target.value;
                    const selectedLocation = locations?.find(l => (l.id === selectedId || l._id === selectedId));
                    console.log('Seçilen yer:', selectedLocation, 'ID:', selectedId);
                  }}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                  disabled={isLoading}
                >
                  <option value="">Yer seçin</option>
                  {locations?.map((location, index) => {
                    const locationId = location.id || location._id || '';
                    const locationName = location.name || 'İsimsiz yer';
                    console.log(`Yer option: ID=${locationId}, Name=${locationName}`);
                    return (
                      <option key={location.id || location._id || `location-${index}`} value={locationId}>
                        {locationName}
                      </option>
                    );
                  })}
                </select>
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
                    // Seçilen ders tipini logla
                    const selectedId = e.target.value;
                    const selectedCourseType = courseTypes?.find(ct => (ct.id === selectedId || ct._id === selectedId));
                    console.log('Seçilen ders tipi:', selectedCourseType, 'ID:', selectedId);
                  }}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-black"
                  disabled={isLoading}
                >
                  <option value="">Dərs tipi seçin</option>
                  {courseTypes?.map((courseType, index) => {
                    const courseTypeId = courseType.id || courseType._id || '';
                    const courseTypeName = courseType.name || 'İsimsiz tipi';
                    console.log(`Dərs tipi option: ID=${courseTypeId}, Name=${courseTypeName}`);
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
                    selected={formData.date}
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
                  Konu
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
                İptal
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
        <div className="fixed inset-0 z-50 flex h-screen items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="relative max-w-md w-full rounded-xl bg-white p-6 shadow-2xl border border-gray-200">
            <button 
              onClick={handleCloseDetails}
              className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Kapat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            
            <div className="flex items-center mb-5">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center mr-4 ${getTypeColor(selectedLesson.type)}`}>
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{selectedLesson.courseName}</h3>
                <p className="text-gray-700 font-medium">{selectedLesson.subject}</p>
              </div>
            </div>
            
            <div className="mb-6 space-y-4">
              <div className="flex items-center p-2 rounded-lg bg-blue-50">
                <Calendar className="h-5 w-5 text-blue-600 mr-3" />
              <div>
                  <p className="text-sm font-medium text-gray-700">Tarix ve Gün</p>
                  <p className="text-gray-900 font-medium">
                  {selectedLesson.date ? new Date(selectedLesson.date).toLocaleDateString('tr-TR', { 
                      year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'long' 
                  }) : 'Tarix məlumatı yoxdur'}
                </p>
              </div>
              </div>
              
              <div className="flex items-center p-2 rounded-lg bg-green-50">
                <Clock className="h-5 w-5 text-green-600 mr-3" />
              <div>
                  <p className="text-sm font-medium text-gray-700">Saat</p>
                  <p className="text-gray-900 font-medium">{selectedLesson.startTime} - {selectedLesson.endTime}</p>
              </div>
              </div>
              
              
              
              <div className="flex items-center p-2 rounded-lg bg-purple-50">
                <User className="h-5 w-5 text-purple-600 mr-3" />
              <div>
                  <p className="text-sm font-medium text-gray-700">Müəllim</p>
                  <p className="text-gray-900 font-medium">
                    {(() => {
                      const teacher = selectedLesson.teacher as Teacher | undefined;
                      
                      // First check for teacherName
                      if (selectedLesson.teacherName) {
                        return selectedLesson.teacherName;
                      }
                      
                      // Then check for teacher object
                      if (teacher?.firstName && teacher?.lastName) {
                        return `${teacher.firstName} ${teacher.lastName}`;
                      }
                      
                      // Finally check in Redux store
                      const matchingTeacher = teachers.find((t: Teacher) => 
                        t.id === selectedLesson.teacherId || t._id === selectedLesson.teacherId
                      );
                      
                      if (matchingTeacher?.firstName && matchingTeacher?.lastName) {
                        return `${matchingTeacher.firstName} ${matchingTeacher.lastName}`;
                      }
                      
                      return 'Müəllim seçilmədi';
                    })()}
                  </p>
              </div>
              </div>
              
              <div className="flex items-center p-2 rounded-lg bg-yellow-50">
                <MapPin className="h-5 w-5 text-yellow-600 mr-3" />
              <div>
                  <p className="text-sm font-medium text-gray-700">Ders Yeri</p>
                  <p className="text-gray-900 font-medium">{selectedLesson.locationName}</p>
              </div>
              </div>
              
              <div className="flex items-center p-2 rounded-lg bg-red-50">
                <BookOpen className="h-5 w-5 text-red-600 mr-3" />
              <div>
                  <p className="text-sm font-medium text-gray-700">Ders Tipi</p>
                  <p className="text-gray-900 font-medium">{selectedLesson.type}</p>
              </div>
            </div>
            
              <div className="p-2 rounded-lg bg-indigo-50">
                <div className="flex items-center mb-1">
                  <BookOpen className="h-5 w-5 text-indigo-600 mr-3" />
                  <p className="text-sm font-medium text-gray-700">Dərs Açıqlaması</p>
                </div>
                <div className="ml-8 mt-1">
                  <div className="text-gray-900">
                    {(() => {
                      // Önce subject (konu) alanını göster
                      if (selectedLesson.subject) {
                        return (
                          <div>
                            <span>{selectedLesson.subject}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                   
                    
                    {(() => {
                      // Notlar varsa göster
                      if (selectedLesson?.notes) {
                        return (
                          <div className="mt-2">
                            <span>{selectedLesson.notes}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={() => handleEdit(selectedLesson)}
                className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-4 py-2.5 text-blue-700 hover:bg-blue-200 transition-colors font-medium"
                disabled={isLoading}
              >
                <Edit size={16} />
                <span>Düzenle</span>
              </button>
              <button
                onClick={() => handleDelete(selectedLesson.id)}
                className="flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2.5 text-red-700 hover:bg-red-200 transition-colors font-medium"
                disabled={isLoading}
              >
                <Trash size={16} />
                <span>Sil</span>
              </button>
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

      {/* Weekly Schedule Grid View */}
      {!isLoading && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-md overflow-x-auto max-h-[calc(100vh-200px)]">
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
            const hasLessonsForDay = currentWeekLessons.some(lesson => {
              if (lesson.date) {
                const lessonDate = new Date(lesson.date);
                return formatDateForComparison(lessonDate) === dateString;
              }
              return false;
            });
                
                // Is it weekend?
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
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
                <div className="relative flex-grow p-2 h-48">
                  {/* Hour grid lines */}
                  <div className="absolute inset-0">
                    <div className="flex h-full justify-between">
                      {hourLabels.map((_, index) => (
                        <div key={index} className="h-full w-px bg-gray-100"></div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Lessons */}
                  {currentWeekLessons
                    .filter(lesson => {
                      if (lesson.date) {
                        const lessonDate = new Date(lesson.date);
                        return formatDateForComparison(lessonDate) === dateString;
                      }
                      return false;
                    })
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((lesson, lessonIndex, filteredLessons) => {
                      const { left, width } = calculateGridPosition(lesson.startTime, lesson.endTime);
                      
                      // Find all lessons that overlap with this one
                      const overlappingLessons = filteredLessons.filter(otherLesson => 
                        checkOverlap(lesson, otherLesson)
                      );
                      
                      // Add current lesson to the group
                      const allRelatedLessons = [lesson, ...overlappingLessons];
                      
                      // Sort by ID to maintain consistent ordering
                      const sortedLessons = allRelatedLessons.sort((a, b) => a.id.localeCompare(b.id));
                      
                      // Find position of current lesson in the group
                      const positionInGroup = sortedLessons.findIndex(l => l.id === lesson.id);
                      
                      // Calculate appropriate height and offset
                      const heightPerLesson = 60; // pixels
                      const topOffset = positionInGroup * heightPerLesson;
                      
                      return (
                        <div
                          key={lesson.id}
                          className={`absolute rounded-md py-1 px-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 ${getTypeColor(lesson.type)}`}
                          style={{ 
                            left, 
                            width, 
                            top: `${topOffset}px`,
                            height: `${heightPerLesson - 2}px`,
                            zIndex: positionInGroup + 1
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
                            
                            <div className="font-bold truncate">{lesson.courseName}</div>
                            <div className="truncate font-medium">
                              {(() => {
                                const teacher = lesson.teacher as Teacher | undefined;
                                
                                // First check for teacherName
                                if (lesson.teacherName) {
                                  return lesson.teacherName;
                                }
                                
                                // Then check for teacher object
                                if (teacher?.firstName && teacher?.lastName) {
                                  return `${teacher.firstName} ${teacher.lastName}`;
                                }
                                
                                // Finally check in Redux store
                                const matchingTeacher = teachers.find((t: Teacher) => 
                                  t.id === lesson.teacherId || t._id === lesson.teacherId
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
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
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