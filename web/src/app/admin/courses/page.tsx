'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Edit, Trash, Plus, Search, Loader, BookX, BookCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { 
  fetchCourses, 
  createCourse, 
  updateCourse, 
  deleteCourse, 
  resetCourseError,
  toggleCourseStatus 
} from '@/redux/slices/courseSlice';
import { fetchTeachers } from '@/redux/slices/teacherSlice';

// Form initial state
const emptyForm = {
  name: '',
  description: '',
};



export default function CoursesPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { courses, isLoading, error } = useAppSelector((state) => state.courses);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    type: 'success' | 'error' | 'delete' | 'warning';
  }>({
    open: false,
    message: '',
    type: 'success',
  });

  // Show snackbar function
  const showSnackbar = (message: string, type: 'success' | 'error' | 'delete' | 'warning' = 'success') => {
    setSnackbar({ open: true, message, type });
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, open: false }));
    }, 5000);
  };

  // Close snackbar function
  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Debug log mounts/updates
  useEffect(() => {
    console.log('CoursesPage mounted/updated');
    console.log('Courses state:', { 
      courses, 
      isLoading, 
      error, 
      count: courses?.length || 0 
    });
  }, [courses, isLoading, error]);

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

  // Kursları ve öğretmenleri yükle
  useEffect(() => {
    if (user && user.role === 'admin' && isAuthenticated) {
      console.log('Dispatching fetchCourses with status:', activeTab);
      dispatch(fetchCourses(activeTab));
      dispatch(fetchTeachers('active'));
    }
  }, [dispatch, user, isAuthenticated, activeTab]);

  // Filter courses based on search term
  const filteredCourses = courses.filter(
    (course) =>
      course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (course.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    
    setFormError(null);
    // Clear Redux error when user types
    if (error) {
      dispatch(resetCourseError());
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form doğrulama
    if (!formData.name) {
      setFormError('Lütfen kurs adını girin.');
      return;
    }
    
    try {
      if (editingId) {
        // Update existing course
        await dispatch(updateCourse({ 
          id: editingId, 
          courseData: formData 
        })).unwrap();
        
        // Güncelleme sonrası kursları yeniden çek
        await dispatch(fetchCourses(activeTab));
        
        // Reset form on success
        setFormData(emptyForm);
        setShowForm(false);
        setEditingId(null);
        showSnackbar('Ders ugurla düzəliş edildi.');
      } else {
        // Add new course
        await dispatch(createCourse(formData)).unwrap();
        
        // Oluşturma sonrası kursları yeniden çek
        await dispatch(fetchCourses(activeTab));
        
        // Reset form on success
        setFormData(emptyForm);
        setShowForm(false);
        showSnackbar('Yeni ders ugurla əlavə edildi.');
      }
    } catch (err) {
      // Error handling is managed by Redux
      console.error('Course operation failed:', err);
      showSnackbar('Ders işlemi sırasında bir hata oluştu.', 'warning');
    }
  };

  // Handle edit
  const handleEdit = (course: typeof courses[0]) => {
    console.log('Editing course:', course);
    setFormData({
      name: course.name,
      description: course.description || '',
    });
    setEditingId(course.id);
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (confirm('Bu dersi silmek istediğinize emin misiniz?')) {
      try {
        await dispatch(deleteCourse(id)).unwrap();
        
        // Silme işlemi sonrası kursları yeniden çek
        await dispatch(fetchCourses(activeTab));
        showSnackbar('Ders ugurla silindi.', 'delete');
      } catch (err: unknown) {
        // Error handling is managed by Redux
        console.error('Failed to delete course:', err);
        
        // Check if course is in use
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        if (errorMessage.includes('Bu ders programda kullanılıyor')) {
          showSnackbar('Bu ders programda kullanılıyor ve silinemez.', 'warning');
        } else {
          showSnackbar('Ders silme işlemi sırasında bir hata oluştu.', 'warning');
        }
      }
    }
  };

  // Handle ders status toggle
  const handleToggleStatus = async (id: string, currentStatus: boolean | undefined) => {
    const statusText = currentStatus ? 'pasif' : 'aktif';
    const confirmMessage = `Bu dərsi ${statusText} duruma getirmek istədiyinizə əminsiniz?`;
    
    if (confirm(confirmMessage)) {
      try {
        await dispatch(toggleCourseStatus(id)).unwrap();
        
        // İşlem sonrası kursları yeniden çek
        await dispatch(fetchCourses(activeTab));
        showSnackbar(`Dərs durumu ugurla ${statusText} edildi.`, 'success');
      } catch (err) {
        console.error('Dərs durumu dəyişdirmə əməliyyatı baş verdi:', err);
        showSnackbar('Dərs durumu dəyişdirmə əməliyyatı sırasında bir xəta baş verdi.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ders İdarəetməsi</h1>
          <p className="text-gray-600">Dersleri əlavə edin, düzəldin və idarə edin</p>
        </div>
        <button
          onClick={() => {
            setFormData(emptyForm);
            setEditingId(null);
            setFormError(null);
            setShowForm(!showForm);
          }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          disabled={isLoading}
        >
          <Plus size={16} />
          <span>Dərs Əlavə Et</span>
        </button>
      </div>

      {/* Redux Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Add/Edit Course Form */}
      {showForm && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            {editingId ? 'Düzəliş Et' : 'Yeni Ders Əlavə Et'}
          </h2>
          
          {formError && (
            <div className="mb-4 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-800">
              <p>{formError}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Ders Adı
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Açıqlama
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                  dispatch(resetCourseError());
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

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex">
          <button
            onClick={() => setActiveTab('active')}
            className={`inline-flex items-center border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === 'active'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <BookCheck size={16} className="mr-2" />
            Aktiv Derslər
          </button>
          <button
            onClick={() => setActiveTab('inactive')}
            className={`ml-8 inline-flex items-center border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === 'inactive'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <BookX size={16} className="mr-2" />
            Passiv Derslər
          </button>
        </nav>
      </div>

      {/* Search Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-5 h-5 text-gray-500" />
        </div>
        <input
          type="text"
          className="block w-full rounded-lg border border-gray-300 bg-white p-2.5 pl-10 text-gray-800 focus:border-blue-500 focus:ring-blue-500"
          placeholder="Ders ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Courses List */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader size={30} className="animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Dersler yükleniyor...</span>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {searchTerm 
              ? 'Arama kriterlerine uygun ders bulunamadı.' 
              : activeTab === 'active'
                ? 'Aktiv ders tapılmadı.'
                : 'Passiv ders tapılmadı.'
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-800">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3">
                    Ders Adı
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Açıqlama
                  </th>
                  <th scope="col" className="px-6 py-3">
                    <span className="sr-only">Əməliyyatlar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((course) => (
                  <tr 
                    key={course.id || course._id} 
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center">
                        <BookOpen className="h-5 w-5 text-blue-500 mr-2" />
                        {course.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {course.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(course)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Düzenle"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(course.id || course._id || '', course.isActive)}
                          title={course.isActive ? 'Passiv et' : 'Aktiv et'}
                          className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full"
                        >
                          <span className={`${course.isActive ? 'bg-green-500' : 'bg-red-500'} absolute h-5 w-9 rounded-full transition`} />
                          <span className={`${course.isActive ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition`} />
                        </button>
                        {activeTab === 'inactive' && (
                          <button
                            onClick={() => handleDelete(course.id || course._id || '')}
                            className="text-red-600 hover:text-red-800"
                            title="Sil"
                          >
                            <Trash size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Snackbar Notification */}
      {snackbar.open && (
        <div className={`fixed top-4 right-4 z-50 max-w-md rounded-lg shadow-lg ${
          snackbar.type === 'success' ? 'bg-green-100 border-l-4 border-green-500' : 
          snackbar.type === 'error' ? 'bg-yellow-100 border-l-4 border-yellow-500' : 
          snackbar.type === 'delete' ? 'bg-red-100 border-l-4 border-red-500' :
          'bg-yellow-100 border-l-4 border-yellow-500'
        }`}>
          <div className="flex items-center p-4">
            <div className="flex-shrink-0">
              {snackbar.type === 'success' && (
                <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {snackbar.type === 'warning' && (
                <svg className="h-6 w-6 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {snackbar.type === 'error' && (
                <svg className="h-6 w-6 text-yellow-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {snackbar.type === 'delete' && (
                <svg className="h-6 w-6 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                snackbar.type === 'success' ? 'text-green-800' : 
                snackbar.type === 'error' ? 'text-yellow-800' : 
                snackbar.type === 'delete' ? 'text-red-800' :
                'text-yellow-800'
              }`}>
                {snackbar.message}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={closeSnackbar}
                className="inline-flex h-8 w-8 rounded-lg bg-white p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 focus:ring-2 focus:ring-gray-300"
              >
                <span className="sr-only">Kapat</span>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 