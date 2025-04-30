'use client';

import { useState, useEffect } from 'react';
import { Activity, Users, MapPin, Loader, Download, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { fetchSchedules } from '@/redux/slices/scheduleSlice';
import { fetchTeachers } from '@/redux/slices/teacherSlice';
import { fetchLocations } from '@/redux/slices/locationSlice';
import { fetchSeasons } from '@/redux/slices/seasonSlice';
import { fetchCourseTypes } from '@/redux/slices/courseTypeSlice';
import * as XLSX from 'xlsx';

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

// Define a proper type for teacherId
type TeacherId = string | { id: string; name?: string; email?: string };

export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [showSignatureExport, setShowSignatureExport] = useState(false);
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
  const { schedules } = useAppSelector((state) => state.schedules);
  const { teachers } = useAppSelector((state) => state.teachers);
  const { locations } = useAppSelector((state) => state.locations);
  const { seasons } = useAppSelector((state) => state.seasons);

  // Admin yetkisi kontrolü
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    } else if (!isAuthenticated) {
      router.push('/login');
    } else {
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
            dispatch(fetchLocations()),
            dispatch(fetchSchedules()),
            dispatch(fetchSeasons('active')),
            dispatch(fetchCourseTypes('active'))
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

 

  // Get upcoming lessons for the next 7 days
  const getUpcomingLessons = () => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    return schedules
      .filter(schedule => {
        const lessonDate = new Date(schedule.date);
        return lessonDate >= today && lessonDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
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
      title: 'Dərs Yerləri',
      value: isLoading ? '-' : locations.length,
      icon: <MapPin size={24} className="text-white" />,
      color: 'bg-purple-500',
    },
    {
      title: 'Mövcud Kurslar',
      value: isLoading ? '-' : seasons.filter(s => s.isActive).length,
      icon: <Activity size={24} className="text-white" />,
      color: 'bg-orange-500',
    },
  ];

  // Yaklaşan dersler
  const upcomingLessons = getUpcomingLessons();

  // Update getTeacherName function with proper type handling
  const getTeacherName = (teacherIds: TeacherId[]): string => {
    if (!Array.isArray(teacherIds) || teacherIds.length === 0) return "Belirtilmemiş";

    return teacherIds
      .map(teacherId => {
        // Handle case where teacherId is an object
        if (typeof teacherId === 'object' && teacherId !== null) {
          if (teacherId.name) return teacherId.name;
          if (teacherId.id) {
            const teacher = teachers.find(t => t.id === teacherId.id || t._id === teacherId.id);
            if (teacher) return `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
          }
        }
        // Handle case where teacherId is a string
        if (typeof teacherId === 'string') {
    const teacher = teachers.find(t => t.id === teacherId || t._id === teacherId);
          if (teacher) return `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
    }
        return '';
      })
      .filter(name => name) // Remove empty strings
      .join("\n") || "Belirtilmemiş"; // Use newline instead of comma
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

  const exportSeasonLessonsToExcel = () => {
    if (isLoading || schedules.length === 0 || !selectedSeason) {
      showSnackbar("İxrac üçün kurs seçilməlidir", "error");
      return;
    }
    
    try {
      // Find the selected season
      const season = seasons.find(s => s.id === selectedSeason);
      if (!season) {
        showSnackbar("Seçilmiş kurs tapılmadı", "error");
        return;
      }
      
      // Filter lessons for this season
      const seasonLessons = schedules.filter(lesson => 
        lesson.seasonId === selectedSeason
      );
      
      if (seasonLessons.length === 0) {
        showSnackbar("Seçilmiş kurs üçün dərs tapılmadı", "error");
        return;
      }
      
      // Sort by date and time
      seasonLessons.sort((a, b) => {
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
      
      // Format dates using season's own start and end dates
      let formattedFirstDate = "";
      let formattedLastDate = "";
      
      if (season.startDate) {
        const startDate = new Date(season.startDate);
        formattedFirstDate = `${String(startDate.getDate()).padStart(2, '0')}.${String(startDate.getMonth() + 1).padStart(2, '0')}.${startDate.getFullYear()}`;
      } else {
        // Fallback to first lesson date if season start date is not available
        const firstLesson = seasonLessons[0];
        const firstDate = new Date(firstLesson.date);
        formattedFirstDate = `${String(firstDate.getDate()).padStart(2, '0')}.${String(firstDate.getMonth() + 1).padStart(2, '0')}.${firstDate.getFullYear()}`;
      }
      
      if (season.endDate) {
        const endDate = new Date(season.endDate);
        formattedLastDate = `${String(endDate.getDate()).padStart(2, '0')}.${String(endDate.getMonth() + 1).padStart(2, '0')}.${endDate.getFullYear()}`;
      } else {
        // Fallback to last lesson date if season end date is not available
        const lastLesson = seasonLessons[seasonLessons.length - 1];
        const lastDate = new Date(lastLesson.date);
        formattedLastDate = `${String(lastDate.getDate()).padStart(2, '0')}.${String(lastDate.getMonth() + 1).padStart(2, '0')}.${lastDate.getFullYear()}`;
      }
      
      // Find exam date (if any)
      const examLessons = seasonLessons.filter(lesson => 
        lesson.subject && lesson.subject.toLowerCase().includes('exam')
      );
      
      let examDateStr = '';
      if (examLessons.length > 0) {
        const examDate = new Date(examLessons[0].date);
        examDateStr = `İmtahan: ${String(examDate.getDate()).padStart(2, '0')}.${String(examDate.getMonth() + 1).padStart(2, '0')}.${examDate.getFullYear()}`;
      }
      
      // Title and course info rows
      const courseTitle = [`${season.name} - ${season.name}`];
      const courseInfo = [`Başlama: ${formattedFirstDate}, Bitirmə: ${formattedLastDate}, ${examDateStr}`];
      
      // Header row
      const headerRow = ['Tarix', 'Saat', 'Müəllimlər', 'Mövzu'];
      
      // Add rows to worksheet
      XLSX.utils.sheet_add_aoa(ws, [courseTitle], { origin: 'A1' });
      XLSX.utils.sheet_add_aoa(ws, [courseInfo], { origin: 'A2' });
      XLSX.utils.sheet_add_aoa(ws, [headerRow], { origin: 'A4' });
      
      // Apply styles to header row - bold and light gray background
      for (let col = 0; col < 4; col++) {
        const cellRef = XLSX.utils.encode_cell({r: 3, c: col}); // 4th row (0-indexed)
        if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headerRow[col] };
        
        if (!ws[cellRef].s) ws[cellRef].s = {};
        
        // Bold text
        ws[cellRef].s.font = { bold: true };
        
        // Light gray background
        ws[cellRef].s.fill = { 
          fgColor: { rgb: "EEEEEE" }, // Light gray
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
      const lessonsByDate: Record<string, typeof seasonLessons> = {};
      seasonLessons.forEach(lesson => {
        const dateStr = new Date(lesson.date).toISOString().split('T')[0];
        if (!lessonsByDate[dateStr]) {
          lessonsByDate[dateStr] = [];
        }
        lessonsByDate[dateStr].push(lesson);
      });
      
      // Initialize merges array with title and subtitle merges
      const merges: { s: { r: number, c: number }, e: { r: number, c: number } }[] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } }  // Course duration
      ];
      
      // Add data rows
      let rowIndex = 5; // Start at row 5 (after headers)
      
      // Process each date group
      Object.entries(lessonsByDate).forEach(([dateStr, lessons]) => {
        const date = new Date(dateStr);
        // Format date as DD.MM.YYYY
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
        
        // Record the first row of this date to merge cells later
        const dateStartRow = rowIndex;
        
        // Sort lessons by time for this day
        lessons.sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        // Process each lesson for this date
        lessons.forEach((lesson, index) => {
          const teacherName = getTeacherName(lesson.teacherIds);
          
          // Format time range as HH:MM-HH:MM
          const formattedTime = `${lesson.startTime}-${lesson.endTime}`;
          
          // Create the lesson row
          const lessonRow = [
            index === 0 ? formattedDate : '', // Only show date on first lesson of the day
            formattedTime,
            teacherName,
            lesson.subject || ''
          ];
          
          XLSX.utils.sheet_add_aoa(ws, [lessonRow], { origin: `A${rowIndex}` });
          
          // Apply borders to all cells in the row
          for (let col = 0; col < 4; col++) {
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
          
          // Check if this is a practical lesson
          const isPractical = lesson.subject && 
            (lesson.subject.toLowerCase().includes('praktiki') || 
             lesson.subject.toLowerCase().includes('məşğələ'));
          
          // Apply yellow background for practical lessons
          if (isPractical) {
            // Set background color for all cells in this row
            for (let col = 0; col < 4; col++) {
              const cellRef = XLSX.utils.encode_cell({r: rowIndex-1, c: col});
              
              if (!ws[cellRef].s) ws[cellRef].s = {};
              ws[cellRef].s.fill = { 
                fgColor: { rgb: "FFFF00" }, // Yellow color
                patternType: "solid"
              };
            }
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
        { wch: 12 }, // Date
        { wch: 12 }, // Time
        { wch: 20 }, // Teacher
        { wch: 90 }  // Subject (extra wide for long text)
      ];
      
      // Apply merges to worksheet
      ws['!merges'] = merges;
      
      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(workbook, ws, 'Dərs Cədvəli');
      
      // Create the Excel file
      const seasonName = season.name.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');
      XLSX.writeFile(workbook, `${seasonName}_ders_cedveli.xlsx`);
      
      showSnackbar(`"${season.name}" kursu üçün dərs cədvəli uğurla ixrac edildi`);
    } catch (error) {
      console.error('Export error:', error);
      showSnackbar("Kurs dərsləri ixrac edilərkən xəta baş verdi", 'error');
    }
  };

  // Export teacher signature sheet
  const exportTeacherSignatureSheet = () => {
    if (isLoading || !selectedSeason || !selectedTeacher) {
      showSnackbar("İxrac üçün kurs və müəllim seçilməlidir", "error");
      return;
    }
    
    try {
      // Find the selected season and teacher
      const season = seasons.find(s => s.id === selectedSeason || s._id === selectedSeason);
      const teacher = teachers.find(t => t.id === selectedTeacher || t._id === selectedTeacher);
      
      if (!season || !teacher) {
        showSnackbar("Seçilmiş kurs və ya müəllim tapılmadı", "error");
        return;
      }
      
      // Update schedule filtering with proper type handling
      const teacherSchedules = schedules.filter(schedule => 
        schedule.teacherIds.some(teacherId => 
          teacherId.id === selectedTeacher || 
          (teacher && (teacherId.id === teacher._id || teacherId.id === teacher.id))
        )
      );
      
      if (teacherSchedules.length === 0) {
        showSnackbar("Seçilmiş kurs və müəllim üçün dərs tapılmadı", "error");
        return;
      }
      
      // Sort by date
      teacherSchedules.sort((a, b) => {
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
      const teacherName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
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
      const lessonsByDate: Record<string, typeof teacherSchedules> = {};
      teacherSchedules.forEach(lesson => {
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
      
      showSnackbar(`"${teacherName}" müəllimi üçün "${season.name}" kursu imza vərəqi uğurla ixrac edildi`);
    } catch (error) {
      console.error('Export error:', error);
      showSnackbar("İmza vərəqi ixrac edilərkən xəta baş verdi", 'error');
    }
  };

  // Show snackbar function
  const showSnackbar = (message: string, type: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, type });
    // Auto-hide after 3 seconds
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, open: false }));
    }, 3000);
  };

  return (
    <div className="space-y-6">
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ümumi məlumatlar və yükləmə paneli</h1>
          <p className="text-gray-600">Tedris Jurnal sisteminin istatistikası</p>
        </div>
        
     
      </div>
      
      {/* Season Export Section */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Kurs Dərslərini Yüklə</h2>
          <button 
            onClick={() => setShowExportOptions(prev => !prev)}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
          >
            {showExportOptions ? 'Gizlət' : 'Göstər'} 
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showExportOptions ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
        </div>
        
        {showExportOptions && (
          <div className="flex items-end gap-4">
            <div className="flex-grow">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kursu Seçin</label>
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                disabled={isLoading || seasons.length === 0}
              >
                <option value="">Kurs seçin</option>
                {seasons.map((season) => (
                  <option key={season.id || season._id} value={season.id || season._id}>
                    {season.name}
                  </option>
                ))}
              </select>
            </div>
            
            <button 
              onClick={exportSeasonLessonsToExcel}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors w-1/3"
              disabled={isLoading || !selectedSeason}
            >
              <FileText size={18} />
              <span>Kurs Dərslərini yüklə</span>
            </button>
          </div>
        )}
      </div>
      
      {/* Teacher Signature Export Section */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Müəllim İmza Vərəqi</h2>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kursu Seçin</label>
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                  disabled={isLoading || seasons.length === 0}
                >
                  <option value="">Kurs seçin</option>
                  {seasons.map((season) => (
                    <option key={season.id || season._id} value={season.id || season._id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Müəllimi Seçin</label>
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                  disabled={isLoading || teachers.length === 0}
                >
                  <option value="">Müəllim seçin</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id || teacher._id} value={teacher.id || teacher._id}>
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <button 
              onClick={exportTeacherSignatureSheet}
              className="flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
              disabled={isLoading || !selectedSeason || !selectedTeacher}
            >
              <Download size={18} />
              <span>İmza Vərəqini Yüklə</span>
            </button>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
            <span className="text-gray-500">Dərslər yüklənir...</span>
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
                    <p className="font-medium text-gray-800">{lesson.subject || 'Mövzu belirtilmemiş'}</p>
                    <p className="text-sm text-gray-600">
                      {getTeacherName(lesson.teacherIds)}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">{formatDate(lesson.date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-800">{lesson.locationName || getLocationName(lesson.locationId)}</p>
                    <p className="text-sm text-gray-600">{lesson.startTime} - {lesson.endTime}</p>
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