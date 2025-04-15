'use client';

import { useState, useEffect, useMemo } from 'react';
import { User as UserIcon, Calendar, MapPin, Clock, BookOpen, GraduationCap, Mail, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { fetchSchedules } from '@/redux/slices/scheduleSlice';
import { fetchCourses } from '@/redux/slices/courseSlice';
import { fetchLocations } from '@/redux/slices/locationSlice';
import { fetchCourseTypes } from '@/redux/slices/courseTypeSlice';
import { logout } from '@/redux/slices/authSlice';
import api from '@/services/api';

// Define TypeScript interfaces to replace 'any' types
interface Lesson {
  id: string;
  _id?: string;
  teacherId: string;
  courseId: string;
  courseName: string;
  locationId: string;
  locationName?: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  courseTypeId?: string;
  subject?: string;
  notes?: string;
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

interface Course {
  id: string;
  _id?: string;
  name: string;
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
const checkOverlap = (lesson1: Lesson, lesson2: Lesson) => {
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

export default function TeacherDashboard() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Redux state'leri
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { schedules, isLoading: schedulesLoading } = useAppSelector((state) => state.schedules);
  const { courses } = useAppSelector((state) => state.courses);
  const { locations } = useAppSelector((state) => state.locations);
  const { courseTypes } = useAppSelector((state) => state.courseTypes);
  
  // Track monthly lessons separately
  const [monthlyLessons, setMonthlyLessons] = useState<Lesson[]>([]);
  const [loadingMonthlyData, setLoadingMonthlyData] = useState(false);
  
  // Track teacher leaves
  const [teacherLeaves, setTeacherLeaves] = useState<Leave[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  
  // Handle logout
  const handleLogout = () => {
    dispatch(logout());
    router.push('/login');
  };
  
  // Öğretmen yetkisi kontrolü
  useEffect(() => {
    if (user && user.role !== 'teacher') {
      console.log('Non-teacher user detected, redirecting');
      router.push('/');
    } else if (!isAuthenticated) {
      console.log('User not authenticated, redirecting to login');
      router.push('/login');
    } else {
      console.log('Teacher user confirmed:', user?.email);
    }
  }, [user, isAuthenticated, router]);
  
  // Get current week dates starting from the current week
  const getCurrentWeekDates = () => {
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
  };
  
  const weekDates = getCurrentWeekDates();
  
  // Get the start and end date strings for API
  const weekDateParams = useMemo(() => {
    return {
      startDate: formatDateForAPI(weekDates[0]),
      endDate: formatDateForAPI(weekDates[6])
    };
  }, [currentWeekOffset]);
  
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
          console.log(`Fetching schedules for week: ${weekDateParams.startDate} to ${weekDateParams.endDate}`);
          
          await dispatch(fetchSchedules(weekDateParams));
          
          if (courses.length === 0) await dispatch(fetchCourses());
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
  }, [dispatch, user, isAuthenticated, weekDateParams, courses.length, locations.length, courseTypes.length]);
  
  // Separate effect to load monthly data only once on initial load
  useEffect(() => {
    if (user && user.role === 'teacher' && isAuthenticated) {
      setLoadingMonthlyData(true);
      
      const loadMonthlyData = async () => {
        try {
          console.log(`Fetching monthly schedules: ${monthDateParams.startDate} to ${monthDateParams.endDate}`);
          
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
          console.log(`Fetching leaves for teacher: ${teacherId}`);
          
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
  const handleLessonClick = (lesson: Lesson) => {
    setSelectedLesson(lesson);
  };
  
  // Close details modal
  const handleCloseDetails = () => {
    setSelectedLesson(null);
  };
  
  // Filter teacher's lessons - we only get lessons for the current week now
  const teacherLessons = schedules.filter(lesson => 
    isTeacherMatch(lesson.teacherId, user)
  );
  
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
  
  // Get all unique courses for this teacher
  const uniqueCourses = Array.from(new Set(teacherLessons.map(lesson => lesson.courseId)))
    .map(courseId => {
      const lesson = teacherLessons.find(l => l.courseId === courseId);
      const course = courses.find((c: Course) => c.id === courseId || c._id === courseId);
      
      return {
        id: courseId,
        name: lesson?.courseName || course?.name || 'Bilinmeyen Ders'
      };
    });

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
            <h3 className="font-semibold text-blue-800">Ders İstatistikleri</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-white p-3 rounded-lg">
                <p className="text-sm text-gray-600">Bu Hafta</p>
                <p className="text-2xl font-bold text-blue-600">{lessonCounts.total}</p>
              </div>
              
              {loadingMonthlyData ? (
                <div className="bg-white p-3 rounded-lg flex items-center justify-center">
                  <Loader size={16} className="animate-spin text-blue-500 mr-2" />
                  <p className="text-sm text-gray-600">Yükleniyor...</p>
                </div>
              ) : (
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-sm text-gray-600">Bu Ay</p>
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
      
      {/* Courses Taught */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Verdiğim Dersler</h2>
        {uniqueCourses.length === 0 ? (
          <p className="text-gray-500 text-center py-4">Henüz atanmış ders bulunmamaktadır.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uniqueCourses.map(course => (
              <div key={course.id} className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
                <BookOpen className="text-blue-500" size={24} />
                <div>
                  <div className="font-semibold text-gray-800">{course.name}</div>
                  <div className="text-sm text-gray-600">
                    {teacherLessons.filter(l => l.courseId === course.id).length} Ders
                  </div>
                </div>
              </div>
            ))}
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
          <p className="text-gray-500 text-center py-4">Aktif veya gelecekte planlanmış mezuniyet bulunmamaktadır.</p>
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
          <span>Önceki Hafta</span>
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
                disabled={isLoading || schedulesLoading}
              >
                Bugüne Dön
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
            {weekDates.map((date, dateIndex) => {
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
                            className={`absolute rounded-md py-1 px-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 ${typeColor}`}
                            style={{ 
                              left, 
                              width, 
                              top: `${topOffset}px`,
                              height: `${heightPerLesson - 2}px`,
                              zIndex: positionInGroup + 1
                            }}
                            onClick={() => handleLessonClick(lesson)}
                          >
                            <div className="overflow-hidden text-xs">
                              <div className="font-bold truncate">{lesson.courseName}</div>
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
              <div className={`h-12 w-12 rounded-full flex items-center justify-center mr-4 ${getTypeColor(selectedLesson.type, courseTypes)}`}>
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">{selectedLesson.courseName}</h3>
                {selectedLesson.subject && <p className="text-gray-700 font-medium">{selectedLesson.subject}</p>}
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
                  <p className="text-gray-900 font-medium">
                    {selectedLesson.type === 'lecture' ? 'Normal Ders' : 
                     selectedLesson.type === 'practice' ? 'Pratik/Uygulama' : 'Sınav'}
                  </p>
                </div>
              </div>
              
              {selectedLesson.subject && (
                <div className="p-2 rounded-lg bg-indigo-50">
                  <div className="flex items-center mb-1">
                    <BookOpen className="h-5 w-5 text-indigo-600 mr-3" />
                    <p className="text-sm font-medium text-gray-700">Ders Açıqlaması</p>
                  </div>
                  <div className="ml-8 mt-1">
                    <div className="text-gray-900">
                      <div>
                        <span>{selectedLesson.subject}</span>
                      </div>
                      
                      {selectedLesson.notes && (
                        <div className="mt-2">
                          <span>{selectedLesson.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 