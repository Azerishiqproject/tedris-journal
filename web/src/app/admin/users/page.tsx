'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash, Plus, Search, Loader, UserX, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { 
  fetchTeachers, 
  createTeacher, 
  updateTeacher, 
  deleteTeacher, 
  resetTeacherError,
  toggleTeacherStatus 
} from '@/redux/slices/teacherSlice';

// Form initial state
const emptyForm = {
  firstName: '',
  lastName: '',
  specialty: '',
  academicDegree: '',
  email: '',
  password: '',
};

export default function UsersPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, token, isAuthenticated } = useAppSelector((state) => state.auth);
  const { teachers, isLoading, error } = useAppSelector((state) => state.teachers);
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

  // Debug auth state
  useEffect(() => {
    console.log('UsersPage mounted/updated');
    console.log('Auth state:', { user, token, isAuthenticated });
    
    // Check localStorage directly
    if (typeof window !== 'undefined') {
      console.log('localStorage token:', localStorage.getItem('token'));
    }
    
    // Debug teachers state
    console.log('Teachers state:', { 
      teachers, 
      isLoading, 
      error, 
      count: teachers?.length || 0 
    });
  }, [user, token, isAuthenticated, teachers, isLoading, error]);

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

  // Fetch teachers from API through Redux with status filter
  useEffect(() => {
    console.log('Checking if should fetch teachers:', {
      user: !!user,
      role: user?.role,
      isAuthenticated,
      activeTab
    });
    
    if (user && user.role === 'admin' && isAuthenticated) {
      console.log('Dispatching fetchTeachers with status:', activeTab);
      dispatch(fetchTeachers(activeTab));
    }
  }, [dispatch, user, isAuthenticated, activeTab]);

  // Filter teachers based on search term
  const filteredTeachers = teachers.filter(
    (teacher) =>
      teacher.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormError(null);
    // Clear Redux error when user types
    if (error) {
      dispatch(resetTeacherError());
    }
  };

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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form doğrulama
    if (!formData.firstName || !formData.lastName || !formData.email || 
        (!editingId && !formData.password)) {
      setFormError('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }
    
    // Email formatını kontrol et
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setFormError('Geçerli bir email adresi girin.');
      return;
    }
    
    try {
      if (editingId) {
        // Mevcut öğretmen bilgilerini bul
        const currentTeacher = teachers.find(t => t.id === editingId || t._id === editingId);
        
        if (!currentTeacher) {
          setFormError('Düzeltiləcək müəllim tapılmadı.');
          return;
        }
        
        // Update existing teacher - Sadece değiştirilen alanları gönderelim
        const dataToUpdate: {
          firstName: string;
          lastName: string;
          email: string;
          specialty: string;
          academicDegree: string;
          password?: string;
        } = {
          firstName: formData.firstName,  // Bu alanları her zaman gönder
          lastName: formData.lastName,    // Bu alanları her zaman gönder
          email: formData.email,          // Bu alanları her zaman gönder
          specialty: formData.specialty,
          academicDegree: formData.academicDegree
        };
        
        // Şifre sadece dolu ise ekle
        if (formData.password) {
          dataToUpdate.password = formData.password;
        }
        
        // En az bir alan değiştiyse güncelleme yap
        await dispatch(updateTeacher({ 
          id: editingId, 
          teacherData: dataToUpdate 
        })).unwrap();
        
        // Güncelleme sonrası öğretmenleri yeniden çek
        await dispatch(fetchTeachers(activeTab));
        showSnackbar(`${formData.firstName} ${formData.lastName} başarıyla güncellendi.`, 'success');
      } else {
        // Add new teacher
        await dispatch(createTeacher(formData)).unwrap();
        
        // Oluşturma sonrası öğretmenleri yeniden çek
        await dispatch(fetchTeachers(activeTab));
        showSnackbar(`${formData.firstName} ${formData.lastName} ugurla əlavə edildi.`, 'success');
        
        // Reset form on success
        setFormData(emptyForm);
        setShowForm(false);
      }
    } catch (err) {
      // Error handling is managed by Redux
      console.error('Teacher operation failed:', err);
      showSnackbar('Müəllim prosesi sırasında bir xəta baş verdi.', 'warning');
    }
  };

  // Handle edit
  const handleEdit = (teacher: typeof teachers[0]) => {
    console.log('Editing teacher:', teacher);
    setFormData({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      specialty: teacher.specialty || '',
      academicDegree: teacher.academicDegree || '',
      password: '', // Password field empty for editing
    });
    // id veya _id'den birini kullan, ikisi de undefined ise null kullan
    setEditingId((teacher.id || teacher._id || null) as string);
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (confirm('Bu müəllimi silmek istediğinize əminsiniz?')) {
      try {
        await dispatch(deleteTeacher(id)).unwrap();
        
        // Silme işlemi sonrası öğretmenleri yeniden çek
        await dispatch(fetchTeachers(activeTab));
        showSnackbar('Müəllim ugurla silindi.', 'delete');
      } catch (err: unknown) {
        // Error handling is managed by Redux
        console.error('Müəllim silmə əməliyyatı baş verdi:', err);
        
        // Check if teacher is in use
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        if (errorMessage.includes('Bu müəllim programda istifadə olunur')) {
          showSnackbar('Bu müəllim programda istifadə olunur və silinə bilməz.', 'warning');
        } else {
          showSnackbar('Müəllim silmə əməliyyatı sırasında bir xəta baş verdi.', 'warning');
        }
      }
    }
  };

  // Handle teacher status toggle
  const handleToggleStatus = async (id: string, currentStatus: boolean | undefined) => {
    const statusText = currentStatus ? 'pasif' : 'aktif';
    const confirmMessage = `Bu müəllimi ${statusText} duruma getirmek istədiyinizə əminsiniz?`;
    
    if (confirm(confirmMessage)) {
      try {
        await dispatch(toggleTeacherStatus(id)).unwrap();
        
        // İşlem sonrası öğretmenleri yeniden çek
        await dispatch(fetchTeachers(activeTab));
        showSnackbar(`Müəllim durumu ugurla ${statusText} edildi.`, 'success');
      } catch (err) {
        console.error('Müəllim durumu dəyişdirmə əməliyyatı baş verdi:', err);
        showSnackbar('Müəllim durumu dəyişdirmə əməliyyatı sırasında bir xəta baş verdi.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Müəllim İdarəetməsi</h1>
          <p className="text-gray-600">Müəllimləri əlavə edin, düzəldin və idarə edin</p>
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
          <span>Müəllim Əlavə Et</span>
        </button>
      </div>

      {/* Redux Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Add/Edit Teacher Form */}
      {showForm && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            {editingId ? 'Müəllim Düzenle' : 'Yeni Müəllim Əlavə et'}
          </h2>
          
          {formError && (
            <div className="mb-4 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-800">
              <p>{formError}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                  Adı
                </label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                  Soyadı
                </label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Şifre {editingId && <span className="text-sm text-gray-500">(değiştirmek için girin)</span>}
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={!editingId}
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="specialty" className="block text-sm font-medium text-gray-700">
                  İxtisas
                </label>
                <input
                  type="text"
                  id="specialty"
                  name="specialty"
                  value={formData.specialty}
                  onChange={handleChange}
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="academicDegree" className="block text-sm font-medium text-gray-700">
                  Akademik Dərəcə
                </label>
                <input
                  type="text"
                  id="academicDegree"
                  name="academicDegree"
                  value={formData.academicDegree}
                  onChange={handleChange}
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
                  resetTeacherError();
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
            <UserCheck size={16} className="mr-2" />
            Aktiv Müəllimlər
          </button>
          <button
            onClick={() => setActiveTab('inactive')}
            className={`ml-8 inline-flex items-center border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === 'inactive'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <UserX size={16} className="mr-2" />
            Passiv Müəllimlər
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
          placeholder="Müəllim axtar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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

      {/* Teachers List */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader size={30} className="animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Müəllimlər yüklənir...</span>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {searchTerm 
              ? 'Arama kriterlerine uyğun müəllim tapılmadı.' 
              : activeTab === 'active'
                ? 'Aktiv müəllim tapılmadı.'
                : 'Passiv müəllim tapılmadı.'
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-800">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3">
                    Adı Soyadı
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Email
                  </th>
                  <th scope="col" className="px-6 py-3">
                    İxtisas
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Akademik Dərəcə
                  </th>
                  <th scope="col" className="px-6 py-3">
                    <span className="sr-only">Əməliyyatlar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr 
                    key={teacher.id || teacher._id} 
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {teacher.firstName || ''} {teacher.lastName || ''}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {teacher.email}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {teacher.specialty || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {teacher.academicDegree || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(teacher)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Düzenle"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(teacher.id || teacher._id || '', teacher.isActive)}
                          title={teacher.isActive ? 'Passiv et' : 'Aktiv et'}
                          className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full"
                        >
                          <span className={`${teacher.isActive ? 'bg-green-500' : 'bg-red-500'} absolute h-5 w-9 rounded-full transition`} />
                          <span className={`${teacher.isActive ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition`} />
                        </button>
                        {activeTab === 'inactive' && (
                          <button
                            onClick={() => handleDelete(teacher.id || teacher._id || '')}
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
    </div>
  );
} 