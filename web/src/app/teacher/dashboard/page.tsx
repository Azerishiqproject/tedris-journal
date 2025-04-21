'use client';

import { useState, useEffect, useMemo } from 'react';
import { User as UserIcon, Calendar, MapPin, Clock, BookOpen, GraduationCap, Mail, ChevronLeft, ChevronRight, Loader, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { fetchSchedules } from '@/redux/slices/scheduleSlice';
import { fetchLocations } from '@/redux/slices/locationSlice';
import { fetchCourseTypes } from '@/redux/slices/courseTypeSlice';
import { logout } from '@/redux/slices/authSlice';
import api from '@/services/api';
import { Schedule } from '@/redux/types';
import * as XLSX from 'xlsx';



// Define TypeScript interfaces to replace 'any' types
interface Lesson {
  id: string;
  _id?: string;
  teacherId: string;
  courseId?: string;
  courseName?: string;
  locationId: string;
  locationName?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  courseTypeId?: string;
  subject?: string;
  notes?: string;
  isChecked?: boolean;
  seasonName?: string;
  seasonId?: string;
}

interface CourseType {
  id: string;
  _id?: string;
  name: string;
  description?: string;
}

interface Leave {
  id: string;
  _id?: string;
  teacherId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
}

// Define interfaces
interface User {
  id?: string;
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  academicDegree?: string;
  specialty?: string;
  department?: string;
}



// Helper function to get type color - update to use courseTypes from state
const getTypeColor = (typeId: string, courseTypes: CourseType[] = []) => {
  // Generate a color based on typeId if not found
  const colorOptions = [
    'bg-blue-100 border-blue-500 text-blue-800',
    'bg-green-100 border-green-500 text-green-800',
    'bg-yellow-100 border-yellow-500 text-yellow-800',
    'bg-red-100 border-red-500 text-red-800',
    'bg-purple-100 border-purple-500 text-purple-800',
    'bg-indigo-100 border-indigo-500 text-indigo-800',
    'bg-pink-100 border-pink-500 text-pink-800'
  ];
  
  // Find matching courseType
  const courseType = courseTypes.find(t => t.id === typeId || t._id === typeId);
  
  if (!courseType) {
    // If no courseType found, use consistent color based on typeId hash
    const hashCode = typeId.split('').reduce((acc: number, char: string) => {
      return char.charCodeAt(0) + acc;
    }, 0);
    return colorOptions[hashCode % colorOptions.length];
  }
  
  // If courseType found, use name to determine consistent color
  const nameHash = courseType.name.split('').reduce((acc: number, char: string) => {
    return char.charCodeAt(0) + acc;
  }, 0);
  
  return colorOptions[nameHash % colorOptions.length];
};

// Convert time string to minutes
const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};



// Calculate position and width for grid view
const calculateGridPosition = (startTime: string, endTime: string) => {
  const dayStart = 8 * 60; // 8:00 AM in minutes
  const dayEnd = 22 * 60; // 10:00 PM in minutes
  const totalMinutes = dayEnd - dayStart;
  
  const startMinutes = timeToMinutes(startTime) - dayStart;
  const endMinutes = timeToMinutes(endTime) - dayStart;
  const duration = endMinutes - startMinutes;
  
  const startPercent = (startMinutes / totalMinutes) * 100;
  const widthPercent = (duration / totalMinutes) * 100;
  
  return { left: `${startPercent}%`, width: `${widthPercent}%` };
};

// Generate hour labels for the grid
const hourLabels = Array.from({ length: 15 }, (_, i) => {
  const hour = i + 8; // Starting from 8:00
  return `${hour}:00`;
});

// Helper function to format date for API requests
const formatDateForAPI = (date: Date) => {
  return date.toISOString().split('T')[0];
};

// Check if two lessons overlap
const checkOverlap = (lesson1: Lesson | Schedule, lesson2: Lesson | Schedule) => {
  if (lesson1.id === lesson2.id) return false;
  
  // Check if both lessons occur on the same date
  const date1 = lesson1.date ? new Date(lesson1.date).toDateString() : '';
  const date2 = lesson2.date ? new Date(lesson2.date).toDateString() : '';
  
  // Only consider overlap if on the same date
  if (date1 && date2 && date1 === date2) {
    return (
      (lesson1.startTime <= lesson2.startTime && lesson1.endTime > lesson2.startTime) ||
      (lesson1.startTime >= lesson2.startTime && lesson1.startTime < lesson2.endTime)
    );
  }
  
  return false;
};

// Helper function to calculate leave progress
const calculateLeaveProgress = (startDate: Date, endDate: Date) => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // If the leave hasn't started yet
  if (now < start) return 0;
  
  // If the leave has ended
  if (now > end) return 100;
  
  // Calculate percentage
  const totalDuration = end.getTime() - start.getTime();
  const elapsedDuration = now.getTime() - start.getTime();
  
  return Math.round((elapsedDuration / totalDuration) * 100);
};

// Helper function to check teacher ID match
const isTeacherMatch = (teacherId: string, user: User | null) => {
  if (!user) return false;
  return teacherId === user.id || teacherId === user._id;
};



// Helper function to check if current time is within lesson time
const isWithinLessonTime = (lesson: Lesson | Schedule): boolean => {
  if (!lesson.date || !lesson.startTime || !lesson.endTime) return false;
  
  const now = new Date();
  const lessonDate = new Date(lesson.date);
  
  // Check if the lesson is today
  if (lessonDate.getDate() !== now.getDate() || 
      lessonDate.getMonth() !== now.getMonth() || 
      lessonDate.getFullYear() !== now.getFullYear()) {
    return false;
  }
  
  // Convert lesson time to minutes since midnight
  const [startHours, startMinutes] = lesson.startTime.split(':').map(Number);
  const [endHours, endMinutes] = lesson.endTime.split(':').map(Number);
  const startTimeMinutes = startHours * 60 + startMinutes;
  const endTimeMinutes = endHours * 60 + endMinutes;
  
  // Convert current time to minutes since midnight
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeMinutes = currentHours * 60 + currentMinutes;
  
  // Check if current time is within lesson time
  return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
};

export default function TeacherDashboard() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [lessonUpdateLoading, setLessonUpdateLoading] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [showSignatureExport, setShowSignatureExport] = useState(false);
  const [seasons, setSeasons] = useState<{ id: string; _id?: string; name: string; isActive: boolean }[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    open: false,
    message: '',
    type: 'success',
  });
  
  // Redux state'leri
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { schedules, isLoading: schedulesLoading } = useAppSelector((state) => state.schedules);
  const { locations } = useAppSelector((state) => state.locations);
  const { courseTypes } = useAppSelector((state) => state.courseTypes);
  
  // Track monthly lessons separately
  const [monthlyLessons, setMonthlyLessons] = useState<Lesson[]>([]);
  const [loadingMonthlyData, setLoadingMonthlyData] = useState(false);
  
  // Track teacher leaves
  const [teacherLeaves, setTeacherLeaves] = useState<Leave[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  
  // Show snackbar function
  const showSnackbar = (message: string, type: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, type });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, open: false }));
    }, 3000);
  };

  // Load completed lessons from database on initial render
  useEffect(() => {
    if (user?.id) {
      try {
        const fetchCompletedLessons = async () => {
          try {
            
            // Direkt tamamlanmış dersleri çekmek yerine, tüm dersleri çekip filtreleme yapıyoruz
            // /schedules/completed endpoint'i 400 hatası veriyor
            try {
              // Öğretmenin tüm derslerini çek
              const lessonsResponse = await api.get<{ schedules: Lesson[] }>('/schedules');
              
              if (lessonsResponse.data && lessonsResponse.data.schedules) {
                // Önce öğretmenin derslerini filtrele
                const teacherLessons = lessonsResponse.data.schedules.filter(
                  lesson => isTeacherMatch(lesson.teacherId, user)
                );
                
                // Sonra tamamlanmış dersleri filtrele (isChecked = true olanlar)
                const completedLessons = teacherLessons
                  .filter(lesson => lesson.isChecked)
                  .map(lesson => lesson.id);
                
                setCompletedLessons(new Set(completedLessons));
              }
            } catch (apiError) {
              console.error('API error fetching lessons:', apiError);
              
              // Fallback - localStorage kontrolü
              const savedLessons = localStorage.getItem(`completedLessons_${user.id}`);
              if (savedLessons) {
                setCompletedLessons(new Set(JSON.parse(savedLessons)));
              } else {
              }
            }
          } catch (error) {
            console.error('Error loading completed lessons:', error);
            // Fallback to localStorage if API fails
            const savedLessons = localStorage.getItem(`completedLessons_${user.id}`);
            if (savedLessons) {
              setCompletedLessons(new Set(JSON.parse(savedLessons)));
            }
          }
        };
        
        fetchCompletedLessons();
      } catch (error) {
        console.error('Error initializing completed lessons fetch:', error);
      }
    }
  }, [user]);
  
  // Handle logout
  const handleLogout = () => {
    dispatch(logout());
    router.push('/login');
  };
  
  // Öğretmen yetkisi kontrolü
  useEffect(() => {
    if (user && user.role !== 'teacher') {
      router.push('/');
    } else if (!isAuthenticated) {
      router.push('/login');
    } else {
    }
  }, [user, isAuthenticated, router]);
  
  // Get current week dates starting from the current week
  const getCurrentWeekDates = useMemo(() => {
    // Use current date to get current week
    const today = new Date();
    
    // Get Monday of the current week
    const startOfWeek = new Date(today);
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    startOfWeek.setDate(diff);
    
    // Apply week offset
    startOfWeek.setDate(startOfWeek.getDate() + (currentWeekOffset * 7));
    
    // Generate days for the week
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date;
    });
  }, [currentWeekOffset]);
  
  // Get the start and end date strings for API
  const weekDateParams = useMemo(() => {
    return {
      startDate: formatDateForAPI(getCurrentWeekDates[0]),
      endDate: formatDateForAPI(getCurrentWeekDates[getCurrentWeekDates.length - 1])
    };
  }, [getCurrentWeekDates]);
  
  // Get current month date range for monthly stats
  const monthDateParams = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // First day of current month
    const firstDay = new Date(year, month, 1);
    
    // Last day of current month (0th day of next month is the last day of this month)
    const lastDay = new Date(year, month + 1, 0);
    
    return {
      startDate: formatDateForAPI(firstDay),
      endDate: formatDateForAPI(lastDay)
    };
  }, []);
  
  // Veri yükleme - haftalık veri yükleme
  useEffect(() => {
    if (user && user.role === 'teacher' && isAuthenticated) {
      setIsLoading(true);
      
      const loadData = async () => {
        try {
          
          await dispatch(fetchSchedules(weekDateParams));
          
          if (locations.length === 0) await dispatch(fetchLocations());
          if (courseTypes.length === 0) await dispatch(fetchCourseTypes());
          
          setIsLoading(false);
        } catch (error: unknown) {
          console.error('Teacher dashboard data loading error:', error);
          setIsLoading(false);
        }
      };
      
      loadData();
    }
  }, [dispatch, user, isAuthenticated, weekDateParams, locations.length, courseTypes.length]);
  
  // Separate effect to load monthly data only once on initial load
  useEffect(() => {
    if (user && user.role === 'teacher' && isAuthenticated) {
      setLoadingMonthlyData(true);
      
      const loadMonthlyData = async () => {
        try {
          
          const response = await api.get<{ schedules: Lesson[] }>(`/schedules?startDate=${monthDateParams.startDate}&endDate=${monthDateParams.endDate}`);
          
          if (response.data && response.data.schedules) {
            const teacherMonthlyLessons = response.data.schedules.filter((lesson: Lesson) => 
              isTeacherMatch(lesson.teacherId, user)
            );
            setMonthlyLessons(teacherMonthlyLessons);
          }
          
          setLoadingMonthlyData(false);
        } catch (error: unknown) {
          console.error('Monthly data loading error:', error);
          setLoadingMonthlyData(false);
          setMonthlyLessons([]);
        }
      };
      
      loadMonthlyData();
    }
  }, [user, isAuthenticated, monthDateParams]);
  
  // Separate effect to load teacher's leaves
  useEffect(() => {
    if (user && user.role === 'teacher' && isAuthenticated) {
      setLoadingLeaves(true);
      
      const loadTeacherLeaves = async () => {
        try {
          const teacherId = user.id || (user as User)._id;
          
          const response = await api.get<{ leaves: Leave[] }>('/leaves');
          
          if (response.data && response.data.leaves) {
            const now = new Date();
            const filteredLeaves = response.data.leaves
              .filter((leave: Leave) => 
                leave.teacherId === teacherId && 
                new Date(leave.endDate) >= now
              )
              .sort((a: Leave, b: Leave) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
            
            setTeacherLeaves(filteredLeaves);
          }
          
          setLoadingLeaves(false);
        } catch (error: unknown) {
          console.error('Teacher leaves loading error:', error);
          setLoadingLeaves(false);
          setTeacherLeaves([]);
        }
      };
      
      loadTeacherLeaves();
    }
  }, [user, isAuthenticated]);
  
  // Load seasons for the export functionality
  useEffect(() => {
    if (user && user.role === 'teacher' && isAuthenticated) {
      setLoadingSeasons(true);
      
      const loadSeasons = async () => {
        try {
          const response = await api.get('/seasons');
          if (response.data && response.data.seasons) {
            // Only get active seasons
            const activeSeasons = response.data.seasons.filter((season: { id: string; _id?: string; name: string; isActive: boolean }) => season.isActive);
            setSeasons(activeSeasons);
          }
          setLoadingSeasons(false);
        } catch (error) {
          console.error('Error loading seasons:', error);
          setLoadingSeasons(false);
        }
      };
      
      loadSeasons();
    }
  }, [user, isAuthenticated]);
  
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
  
  // Show lesson details when clicked
  const handleLessonClick = (lesson: Lesson | Schedule) => {
    setSelectedLesson(lesson as Lesson);
  };
  
  // Close details modal
  const handleCloseDetails = () => {
    setSelectedLesson(null);
  };
  
  // Filter teacher's lessons - we only get lessons for the current week now
  const teacherLessons = useMemo(() => {
    return schedules.filter(lesson => 
      isTeacherMatch(lesson.teacherId, user)
    );
  }, [schedules, user]);
  
  // Since we're already fetching weekly data, we can use teacherLessons as currentWeekLessons
  const currentWeekLessons = teacherLessons;
  

  
  // Count lessons by type for the current week and month
  const lessonCounts = {
    total: currentWeekLessons.length,
    lecture: currentWeekLessons.filter(lesson => lesson.type === 'lecture').length,
    practice: currentWeekLessons.filter(lesson => lesson.type === 'practice').length,
    exam: currentWeekLessons.filter(lesson => lesson.type === 'exam').length,
    monthTotal: monthlyLessons.length
  };
  
  // Format date for leaves display
  const formatLeaveDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Count lessons by course type for statistics
  const courseTypeStats = useMemo(() => {
    // Initialize counters
    const stats: Record<string, { count: number, name: string, color: string }> = {};
    
    // Get all unique courseTypeIds from lessons
    currentWeekLessons.forEach(lesson => {
      const typeId = lesson.courseTypeId || lesson.type;
      if (!typeId) return;
      
      // Find the course type in the redux state
      const courseType = courseTypes.find(t => t.id === typeId || t._id === typeId);
      const typeName = courseType ? courseType.name : `Type ${typeId.substring(0, 4)}`;
      
      if (!stats[typeId]) {
        stats[typeId] = {
          count: 0,
          name: typeName,
          color: getTypeColor(typeId, courseTypes)
        };
      }
      
      stats[typeId].count++;
    });
    
    // Convert to array for rendering
    return Object.values(stats).sort((a, b) => b.count - a.count);
  }, [currentWeekLessons, courseTypes]);

  // Handle lesson completion toggle
  const handleLessonCompletion = async (lessonId: string, isCompleted: boolean) => {
    // Find the lesson
    const lesson = teacherLessons.find(l => l.id === lessonId);
    
    if (!lesson) {
      console.error('Lesson not found:', lessonId);
      return;
    }
    
    // Check if the teacher can mark this lesson as completed (within lesson time)
    if (isCompleted && !isWithinLessonTime(lesson)) {
      alert('Dərsi yalnız dərs saatları ərzində tamamlaya bilərsiniz!');
      return;
    }
    
    setLessonUpdateLoading(true);
    
    try {
      // API isteği gönder - backend veritabanını güncelle
      console.log(`API request to update lesson completion: ${lessonId}, completed: ${isCompleted}`);
      
      // Backend'deki updateLessonCompletion endpoint'ini çağır
      const response = await api.put(`/schedules/${lessonId}/completion`, {
        completed: isCompleted,
        completedAt: new Date().toISOString(),
        completedBy: user?.id
      });
      
      console.log('API response:', response.data);
      
      // API çağrısı başarılı olduysa, yerel durumu güncelle
      if (response.data && response.data.schedule) {
        // Update local state
        setCompletedLessons(prev => {
          const newSet = new Set(prev);
          if (isCompleted) {
            newSet.add(lessonId);
          } else {
            newSet.delete(lessonId);
          }
          
          // Also update localStorage as a backup
          if (user?.id) {
            try {
              localStorage.setItem(`completedLessons_${user.id}`, JSON.stringify([...newSet]));
            } catch (error: unknown) {
              console.error('Error saving completed lessons to localStorage:', error);
            }
          }
          
          return newSet;
        });
        
        showSnackbar(
          isCompleted ? 'Dərs uğurla tamamlandı!' : 'Dərs tamamlanmamış kimi işarələndi.',
          'success'
        );
      } else {
        throw new Error('API yanıtında beklenen veri bulunamadı');
      }
    } catch (error: unknown) {
      console.error('Error updating lesson completion status:', error);
      // Show more detailed error message
      let errorMessage = 'Dərs statusu yenilənərkən xəta baş verdi.';
      if (error && typeof error === 'object' && 'response' in error) {
        const responseData = error.response && typeof error.response === 'object' && 'data' in error.response 
          ? error.response.data as { message?: string }
          : null;
        if (responseData && responseData.message) {
          errorMessage = responseData.message;
        }
      }
      showSnackbar(errorMessage, 'error');
    } finally {
      setLessonUpdateLoading(false);
    }
  };

  // Export teacher signature sheet - similar to admin dashboard but for current teacher only
  const exportTeacherSignatureSheet = async () => {
    if (!selectedSeason || !user) {
      showSnackbar("İxrac üçün kurs seçilməlidir", "error");
      return;
    }
    
    try {
      // Set loading state
      setIsLoading(true);
      showSnackbar("İmza vərəqi hazırlanır...", "success");
      
      // Find the selected season
      const season = seasons.find(s => s.id === selectedSeason || s._id === selectedSeason);
      
      if (!season) {
        showSnackbar("Seçilmiş kurs tapılmadı", "error");
        setIsLoading(false);
        return;
      }
      
      // Get teacher ID
      const teacherId = user.id || (user as User)._id;
      
      if (!teacherId) {
        showSnackbar("Müəllim məlumatları tapılmadı", "error");
        setIsLoading(false);
        return;
      }
      
      // Fetch all lessons and filter manually since API doesn't properly filter by seasonId
      let teacherLessons: Lesson[] = [];
      
      try {
        console.log(`Fetching all lessons for teacher: ${teacherId}`);
        // Not using seasonId in API call since it's not properly implemented in backend
        const response = await api.get<{ schedules: Lesson[] }>(`/schedules`);
        
        if (response.data && response.data.schedules) {
          // First filter for the current teacher
          const teacherLessonsAll = response.data.schedules.filter(lesson => 
            isTeacherMatch(lesson.teacherId, user)
          );
          
          console.log(`Found ${teacherLessonsAll.length} total lessons for this teacher`);
          
          // Then filter for the selected season
          teacherLessons = teacherLessonsAll.filter(lesson => {
            // Match by both id and _id to handle different formats
            const isSelectedSeason = 
              (lesson.seasonId === selectedSeason) || 
              (lesson._id && lesson.seasonId === season._id) ||
              (lesson.seasonName === season.name);
            
            return isSelectedSeason;
          });
          
          console.log(`Filtered to ${teacherLessons.length} lessons for selected season: ${season.name}`);
        }
      } catch (error) {
        console.error('Error fetching lessons for export:', error);
        showSnackbar("Dərs məlumatları əldə edilərkən xəta baş verdi", "error");
        setIsLoading(false);
        return;
      }
      
      if (teacherLessons.length === 0) {
        showSnackbar("Seçilmiş kurs üçün dərs tapılmadı", "error");
        setIsLoading(false);
        return;
      }
      
      // Sort by date
      teacherLessons.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        return a.startTime.localeCompare(b.startTime);
      });
      
      // Create a new workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);
      
      // Teacher and course title
      const teacherName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const titleRow = [`Müəllim: ${teacherName}`];
      const courseRow = [`Kurs: ${season.name}`];
      
      // Header row
      const headerRow = ['Tarix', 'Dərs adı', 'İmza'];
      
      // Add rows to worksheet
      XLSX.utils.sheet_add_aoa(ws, [titleRow], { origin: 'A1' });
      XLSX.utils.sheet_add_aoa(ws, [courseRow], { origin: 'A2' });
      XLSX.utils.sheet_add_aoa(ws, [headerRow], { origin: 'A4' });
      
      // Apply styles to header row - bold and light gray background
      for (let col = 0; col < 3; col++) {
        const cellRef = XLSX.utils.encode_cell({r: 3, c: col}); // 4th row (0-indexed)
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headerRow[col] };
        
        if (!ws[cellRef].s) ws[cellRef].s = {};
        
        // Bold text
        ws[cellRef].s.font = { bold: true };
        
        // Light gray background
        ws[cellRef].s.fill = { 
          fgColor: { rgb: "EEEEEE" }, 
          patternType: "solid"
        };
        
        // Borders
        ws[cellRef].s.border = {
          top: { style: 'thin', color: { rgb: "000000" } },
          bottom: { style: 'thin', color: { rgb: "000000" } },
          left: { style: 'thin', color: { rgb: "000000" } },
          right: { style: 'thin', color: { rgb: "000000" } }
        };
      }
      
      // Group lessons by date
      const lessonsByDate: Record<string, typeof teacherLessons> = {};
      teacherLessons.forEach(lesson => {
        const dateStr = new Date(lesson.date).toISOString().split('T')[0];
        if (!lessonsByDate[dateStr]) {
          lessonsByDate[dateStr] = [];
        }
        lessonsByDate[dateStr].push(lesson);
      });
      
      // Merge cells array
      const merges: { s: { r: number, c: number }, e: { r: number, c: number } }[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Teacher name
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }  // Course name
      ];
      
      // Add data rows
      let rowIndex = 5; // Start at row 5 (after headers)
      
      // Process each date group
      Object.entries(lessonsByDate).forEach(([dateStr, lessons]) => {
        const date = new Date(dateStr);
        // Format date as DD.MM.YYYY
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
        
        // Record the starting row for this date group (for merging)
        const dateStartRow = rowIndex;
        
        // Add each lesson for this date
        lessons.forEach((lesson, index) => {
          // Create the lesson row
          const lessonRow = [
            index === 0 ? formattedDate : '', // Only show date on first lesson of the day
            lesson.subject || '',
            '' // Empty cell for signature
          ];
          
          XLSX.utils.sheet_add_aoa(ws, [lessonRow], { origin: `A${rowIndex}` });
          
          // Apply borders to all cells in the row
          for (let col = 0; col < 3; col++) {
            const cellRef = XLSX.utils.encode_cell({r: rowIndex-1, c: col});
            if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
            
            if (!ws[cellRef].s) ws[cellRef].s = {};
            
            // Add borders to all cells
            ws[cellRef].s.border = {
              top: { style: 'thin', color: { rgb: "000000" } },
              bottom: { style: 'thin', color: { rgb: "000000" } },
              left: { style: 'thin', color: { rgb: "000000" } },
              right: { style: 'thin', color: { rgb: "000000" } }
            };
          }
          
          rowIndex++;
        });
        
        // Merge date cells if there are multiple lessons for this date
        if (lessons.length > 1) {
          merges.push({
            s: { r: dateStartRow - 1, c: 0 }, // Start cell (0-indexed)
            e: { r: rowIndex - 2, c: 0 }      // End cell (rowIndex-2 because rowIndex was incremented after the last lesson)
          });
        }
      });
      
      // Set column widths
      ws['!cols'] = [
        { wch: 15 }, // Date
        { wch: 50 }, // Subject
        { wch: 20 }  // Signature
      ];
      
      // Add merges to worksheet
      ws['!merges'] = merges;
      
      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, ws, 'İmza Vərəqi');
      
      // Create the Excel file
      const teacherNameClean = teacherName.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');
      const seasonNameClean = season.name.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');
      XLSX.writeFile(workbook, `${teacherNameClean}_${seasonNameClean}_imza_veraqi.xlsx`);
      
      showSnackbar(`"${season.name}" kursu imza vərəqi uğurla ixrac edildi`);
    } catch (error) {
      console.error('Export error:', error);
      showSnackbar("İmza vərəqi ixrac edilərkən xəta baş verdi", 'error');
    } finally {
      setIsLoading(false);
    }
  };

 



  // Loading state
  if (isLoading || schedulesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <Loader size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Müəllim məlumatları yüklənir...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-gray-100">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Müəllim Paneli</h1>
        
        <div className="flex gap-3">
          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 text-white px-4 py-2 hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Çıxış
          </button>
        </div>
      </div>
      
      {/* Teacher Profile Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-shrink-0">
            <div className="w-40 h-40 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              <UserIcon size={64} className="text-gray-400" />
            </div>
          </div>
          
          <div className="flex-grow">
            <h2 className="text-xl font-bold mb-2 text-gray-900">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-gray-600 mb-4">{user?.academicDegree || 'Müəllim'}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <GraduationCap className="text-blue-500" size={18} />
                <span className="text-gray-700">{user?.specialty || 'Belirtilmemiş'}</span>
              </div>
              
              <div className="flex items-center gap-2">
                
              </div>
              
              <div className="flex items-center gap-2">
                <Mail className="text-blue-500" size={18} />
                <span className="text-gray-700">{user?.email}</span>
              </div>
            </div>
          </div>
          
          <div className="flex-shrink-0 flex flex-col gap-2 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800">Ders İstatistikalari</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-gray-600">Bu Həftəki Dərsləriniz</p>
                <p className="text-2xl font-bold text-blue-600">{lessonCounts.total}</p>
              </div>
              
              {loadingMonthlyData ? (
                <div className="bg-white p-3 rounded-lg flex items-center justify-center">
                  <Loader size={16} className="animate-spin text-blue-500 mr-2" />
                  <p className="text-sm text-gray-600">Yükleniyor...</p>
                </div>
              ) : (
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Bu Ayki Dərsləriniz</p>
                  <p className="text-2xl font-bold text-blue-600">{lessonCounts.monthTotal}</p>
                </div>
              )}
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {courseTypeStats.length > 0 ? (
                courseTypeStats.map((stat) => (
                  <div key={stat.name} className="flex items-center gap-2 mb-1">
                    <div 
                      className={`w-3 h-3 rounded-full ${
                        stat.color.includes('bg-') ? 
                          stat.color.split(' ')[0].replace('bg-', 'bg-') : 
                          'bg-gray-500'
                      }`}
                    ></div>
                    <span>{stat.name}: {stat.count}</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 text-xs py-1">
                  Ders tipi bilgisi bulunamadı
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Teacher Signature Export Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">İmza Vərəqi Yükləmə</h2>
          <button 
            onClick={() => setShowSignatureExport(prev => !prev)}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
          >
            {showSignatureExport ? 'Gizlət' : 'Göstər'} 
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showSignatureExport ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        
        {showSignatureExport && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kursu Seçin</label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                disabled={loadingSeasons || seasons.length === 0}
              >
                <option value="">Kurs seçin</option>
                {seasons.map((season) => (
                  <option key={season.id || season._id} value={season.id || season._id}>
                    {season.name}
                  </option>
                ))}
              </select>
              {loadingSeasons && (
                <div className="flex items-center mt-1 text-sm text-gray-500">
                  <Loader size={14} className="animate-spin mr-2" />
                  <span>Kurslar yüklənir...</span>
                </div>
              )}
            </div>
            
            <button 
              onClick={exportTeacherSignatureSheet}
              className="flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
              disabled={isLoading || !selectedSeason}
            >
              {isLoading ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  <span>Hazırlanır...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>İmza Vərəqini Yüklə</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
      
      {/* Teacher Leaves Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Aktif ve Gelecek Mezuniyetlerim</h2>
        
        {loadingLeaves ? (
          <div className="flex items-center justify-center p-8">
            <Loader size={24} className="animate-spin text-blue-500 mr-2" />
            <span className="text-gray-600">Mezuniyet bilgileri yükleniyor...</span>
          </div>
        ) : teacherLeaves.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Aktif vəya gələcəktə planlanmış məzuniyyət tapılmadı</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-left text-sm text-gray-800">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3">Başlangıç</th>
                  <th scope="col" className="px-6 py-3">Bitiş</th>
                  <th scope="col" className="px-6 py-3">Neden</th>
                  <th scope="col" className="px-6 py-3">Durum</th>
                </tr>
              </thead>
              <tbody>
                {teacherLeaves.map((leave: Leave) => {
                  const isActive = new Date(leave.startDate) <= new Date() && new Date(leave.endDate) >= new Date();
                  const isUpcoming = new Date(leave.startDate) > new Date();
                  const progressPercentage = calculateLeaveProgress(
                    new Date(leave.startDate), 
                    new Date(leave.endDate)
                  );
                  
                  return (
                    <tr key={leave.id || leave._id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-700">
                        {formatLeaveDate(leave.startDate)}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {formatLeaveDate(leave.endDate)}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {leave.reason}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {isUpcoming ? (
                            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              Gelecek
                            </span>
                          ) : isActive ? (
                            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                              Aktif
                            </span>
                          ) : null}
                          
                          <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
                            <div 
                              className={`h-2 rounded-full ${
                                isUpcoming ? 'bg-blue-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${progressPercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">{progressPercentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Calendar navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <button 
          onClick={goToPreviousPeriod}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          disabled={isLoading || schedulesLoading}
        >
          <ChevronLeft size={20} />
          <span>Əvvəlki Həftə</span>
        </button>
        
        <div className="text-center">
          <h3 className="font-medium text-gray-800">
            {formatDate(getCurrentWeekDates[0])} - {formatDate(getCurrentWeekDates[getCurrentWeekDates.length - 1])}
          </h3>
          <div className="flex justify-center gap-4 mt-1">
            {currentWeekOffset !== 0 && (
              <button 
                onClick={goToCurrentPeriod}
                className="text-sm text-blue-600 hover:text-blue-800"
                disabled={isLoading || schedulesLoading}
              >
                Bugüne Qayıt
              </button>
            )}
            {(isLoading || schedulesLoading) && (
              <span className="text-sm text-gray-500 flex items-center">
                <Loader size={14} className="animate-spin mr-1" /> 
                Yükleniyor...
              </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={goToNextPeriod}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
          disabled={isLoading || schedulesLoading}
        >
          <span>Sonraki Hafta</span>
          <ChevronRight size={20} />
        </button>
      </div>
      
      {/* Weekly Schedule Grid View */}
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
            {getCurrentWeekDates.map((date, dateIndex) => {
              const dayOfWeek = date.getDay();
              const fullDate = formatDate(date);
              const dateString = formatDateForAPI(date);
              
              // Check if we have any lessons for this day
              const hasLessonsForDay = currentWeekLessons.some(lesson => {
                if (lesson.date) {
                  const lessonDate = new Date(lesson.date);
                  return formatDateForAPI(lessonDate) === dateString;
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
                          return formatDateForAPI(lessonDate) === dateString;
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
                        
                        // Check if the lesson is completed
                        const isCompleted = completedLessons.has(lesson.id);
                        
                        // Determine type color based on lesson type
                        let typeColor = '';
                        switch(lesson.type) {
                          case 'lecture':
                            typeColor = 'bg-gradient-to-r from-green-50 to-green-100 border-green-500 text-green-800';
                            break;
                          case 'practice':
                            typeColor = 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-500 text-yellow-800';
                            break;
                          case 'exam':
                            typeColor = 'bg-gradient-to-r from-red-50 to-red-100 border-red-500 text-red-800';
                            break;
                          default:
                            typeColor = 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-500 text-blue-800';
                        }
                        
                        return (
                          <div
                            key={lesson.id}
                            className={`absolute rounded-md py-1 px-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 ${typeColor} ${isCompleted ? 'ring-2 ring-green-500' : ''}`}
                            style={{ 
                              left, 
                              width, 
                              top: `${topOffset}px`,
                              height: `${heightPerLesson - 2}px`,
                              zIndex: positionInGroup + 1,
                              maxHeight: `${heightPerLesson - 2}px` // Ensure consistent height
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLessonClick(lesson);
                            }}
                          >
                            <div className="relative overflow-hidden text-xs">
                              {/* Check mark indicator for completed lessons */}
                              {isCompleted && (
                                <div className="absolute right-0 bottom-0 bg-green-500 rounded-full p-0.5" title="Tamamlanan dərs">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" 
                                    stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                </div>
                              )}
                              
                              <div className="font-bold truncate">{lesson.subject || "Unnamed Course"}</div>
                              <div className="truncate font-medium">
                                {lesson.locationName}
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
      
      {/* Lesson Details Modal */}
      {selectedLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center h-screen" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
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
                <h4 className="font-bold text-blue-700 text-lg">{selectedLesson.subject || "Unnamed Course"}</h4>
              </div>
              
              {/* Date and Time badges */}
              <div className="flex flex-wrap gap-2 mb-2">
                <div className="flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700">
                  <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                  <span>
                    {selectedLesson.date ? new Date(selectedLesson.date).toLocaleDateString('tr-TR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    }) : 'Tarix məlumatı yoxdur'}
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
                    <BookOpen className="mr-2 h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium text-gray-800">{selectedLesson.seasonName || 'Kurs seçilməyib'}</span>
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
                      <span className="text-sm font-medium text-gray-800">
                        {selectedLesson.type === 'lecture' ? 'Normal Ders' : 
                        selectedLesson.type === 'practice' ? 'Pratik/Uygulama' : 
                        selectedLesson.type === 'exam' ? 'Sınav' : 
                        selectedLesson.type}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Notes if available */}
                {selectedLesson.notes && (
                  <div className="bg-white rounded-md p-3 shadow-sm">
                    <div className="text-xs font-medium uppercase text-gray-500 mb-1">Qeydlər</div>
                    <div className="text-sm text-gray-800 mt-1">{selectedLesson.notes}</div>
                  </div>
                )}
              </div>
              
              {/* Lesson completion status indicator */}
              <div className="flex justify-between items-center px-2">
                <div className="flex items-center">
                  {completedLessons.has(selectedLesson.id) ? (
                    <div className="flex items-center text-green-600 z-10">
                      <div className="bg-green-100 p-1 rounded-full mr-2 z-10">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <span className="text-sm font-medium">Tamamlanan dərs</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-500 z-10">
                      <div className="bg-gray-100 p-1 rounded-full mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                      </div>
                      <span className="text-sm font-medium">Tamamlanmamış dərs</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Add checkbox for teacher to mark the lesson */}
              <div className="mt-1 p-3 border border-gray-200 rounded-lg">
                <label className={`flex items-center ${
                  (!isWithinLessonTime(selectedLesson) && !completedLessons.has(selectedLesson.id)) || lessonUpdateLoading
                    ? 'cursor-not-allowed opacity-60' 
                    : 'cursor-pointer'
                }`}>
                  <input 
                    type="checkbox" 
                    className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    checked={completedLessons.has(selectedLesson.id)}
                    onChange={(e) => handleLessonCompletion(selectedLesson.id, e.target.checked)}
                    disabled={(!isWithinLessonTime(selectedLesson) && !completedLessons.has(selectedLesson.id)) || lessonUpdateLoading}
                  />
                  {lessonUpdateLoading ? (
                    <div className="ml-2 flex items-center">
                      <Loader size={14} className="animate-spin text-blue-500 mr-2" />
                      <span className="text-gray-700 font-medium">Yenilənir...</span>
                    </div>
                  ) : (
                    <span className="ml-2 text-gray-700 font-medium">Bu dərsi tamamladım</span>
                  )}
                </label>
                {!isWithinLessonTime(selectedLesson) && !completedLessons.has(selectedLesson.id) && (
                  <p className="text-xs text-amber-600 mt-1">
                    Dərsi yalnız dərs saatları ərzində ({selectedLesson.startTime}-{selectedLesson.endTime}) tamamlaya bilərsiniz
                  </p>
                )}
              </div>
              
              {/* Action buttons */}
              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-200">
               
                <button
                  onClick={handleCloseDetails}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  Bağla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Snackbar for notifications */}
      {snackbar.open && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg p-4 ${
          snackbar.type === 'success' ? 'bg-green-100 border-l-4 border-green-500' : 
          'bg-red-100 border-l-4 border-red-500'
        }`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {snackbar.type === 'success' ? (
                <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                snackbar.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {snackbar.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 