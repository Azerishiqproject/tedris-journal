'use client';

import { useState, useEffect } from 'react';
import { Activity, Users, BookOpen, MapPin, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { fetchSchedules } from '@/redux/slices/scheduleSlice';
import { fetchTeachers } from '@/redux/slices/teacherSlice';
import { fetchCourses } from '@/redux/slices/courseSlice';
import { fetchLocations } from '@/redux/slices/locationSlice';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  isLoading?: boolean;
}

const StatCard = ({ title, value, icon, color, isLoading = false }: StatCardProps) => (
  <div className="rounded-lg border bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        {isLoading ? (
          <div className="flex items-center mt-1">
            <Loader size={16} className="animate-spin mr-2 text-gray-500" />
            <span className="text-gray-500">Yükleniyor...</span>
          </div>
        ) : (
          <h4 className="mt-1 text-2xl font-semibold text-gray-800">{value}</h4>
        )}
      </div>
      <div className={`rounded-full p-3 ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(true);

  // Redux state'leri
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { schedules } = useAppSelector((state) => state.schedules);
  const { teachers } = useAppSelector((state) => state.teachers);
  const { courses } = useAppSelector((state) => state.courses);
  const { locations } = useAppSelector((state) => state.locations);

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

  // Verileri yükle
  useEffect(() => {
    if (user && user.role === 'admin' && isAuthenticated) {
      setIsLoading(true);
      
      const loadData = async () => {
        try {
          await Promise.all([
            dispatch(fetchTeachers('active')),
            dispatch(fetchCourses()),
            dispatch(fetchLocations()),
            dispatch(fetchSchedules())
          ]);
          setIsLoading(false);
        } catch (error) {
          console.error('Dashboard data loading error:', error);
          setIsLoading(false);
        }
      };
      
      loadData();
    }
  }, [dispatch, user, isAuthenticated]);

  // Bu haftaki dersleri hesapla
  const getThisWeekLessons = () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Pazartesi
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Pazar
    endOfWeek.setHours(23, 59, 59, 999);
    
    return schedules.filter(lesson => {
      const lessonDate = new Date(lesson.date);
      return lessonDate >= startOfWeek && lessonDate <= endOfWeek;
    });
  };

  // Yaklaşan dersleri hesapla (bugün ve sonraki 5 gün)
  const getUpcomingLessons = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const fiveDaysLater = new Date(today);
    fiveDaysLater.setDate(today.getDate() + 5);
    fiveDaysLater.setHours(23, 59, 59, 999);
    
    return schedules
      .filter(lesson => {
        const lessonDate = new Date(lesson.date);
        return lessonDate >= today && lessonDate <= fiveDaysLater;
      })
      .sort((a, b) => {
        // Tarihe göre sırala
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        
        // Aynı günse saate göre sırala
        return a.startTime.localeCompare(b.startTime);
      })
      .slice(0, 5); // İlk 5 dersi göster
  };

  // İstatistik kartları
  const stats = [
    {
      title: 'Toplam Müəllim',
      value: isLoading ? '-' : teachers.length,
      icon: <Users size={24} className="text-white" />,
      color: 'bg-blue-500',
    },
    {
      title: 'Toplam Dərs',
      value: isLoading ? '-' : courses.length,
      icon: <BookOpen size={24} className="text-white" />,
      color: 'bg-green-500',
    },
    {
      title: 'Dərs Yerləri',
      value: isLoading ? '-' : locations.length,
      icon: <MapPin size={24} className="text-white" />,
      color: 'bg-purple-500',
    },
    {
      title: 'Bu Həftə Dərslər',
      value: isLoading ? '-' : getThisWeekLessons().length,
      icon: <Activity size={24} className="text-white" />,
      color: 'bg-orange-500',
    },
  ];

  // Yaklaşan dersler
  const upcomingLessons = getUpcomingLessons();

  // Öğretmen adını bul
  const getTeacherName = (teacherId: string): string => {
    const teacher = teachers.find(t => t.id === teacherId || t._id === teacherId);
    if (teacher) {
      return `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
    }
    return 'Belirtilmemiş';
  };

  // Ders adını bul
  const getCourseName = (courseId: string): string => {
    const course = courses.find(c => c.id === courseId || c._id === courseId);
    return course?.name || 'Belirtilmemiş';
  };

  // Konum adını bul
  const getLocationName = (locationId: string): string => {
    const location = locations.find(l => l.id === locationId || l._id === locationId);
    return location?.name || 'Belirtilmemiş';
  };

  // Tarih formatla
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Tedris Journal sisteminin istatistikası</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            isLoading={isLoading}
          />
        ))}
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-800">Yaxınlaşan Dərslər</h2>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader size={30} className="animate-spin text-blue-500 mr-3" />
            <span className="text-gray-500">Dersler yükleniyor...</span>
          </div>
        ) : upcomingLessons.length === 0 ? (
          <div className="py-6 text-center text-gray-500">
            Yaxınlaşan 5 gün için planlanmış dərs tapılmadı.
          </div>
        ) : (
          <div className="divide-y">
            {upcomingLessons.map((lesson, index) => (
              <div key={lesson.id || index} className="py-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{getCourseName(lesson.courseId)}</p>
                    <p className="text-sm text-gray-600">
                      {lesson.teacherName || getTeacherName(lesson.teacherId)}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">{formatDate(lesson.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-800">{lesson.locationName || getLocationName(lesson.locationId)}</p>
                    <p className="text-sm text-gray-600">{lesson.startTime} - {lesson.endTime}</p>
                    <p className="text-xs inline-block mt-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {lesson.subject}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 