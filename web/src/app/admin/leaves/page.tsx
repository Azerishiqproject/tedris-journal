'use client';

import { useState, useEffect } from 'react';
import { Edit, Trash, Plus, Search, Loader, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import DatePicker from "react-datepicker";
import { registerLocale } from "react-datepicker";
import { tr } from 'date-fns/locale';
import "react-datepicker/dist/react-datepicker.css";

// Import the actions we'll create later
import { 
  fetchLeaves, 
  createLeave, 
  updateLeave, 
  deleteLeave, 
  resetLeaveError 
} from '@/redux/slices/leaveSlice';

import { fetchTeachers } from '@/redux/slices/teacherSlice';

// Define interfaces for our data
interface LeaveData {
  id?: string;
  _id?: string;
  teacherId: string;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
}

interface TeacherData {
  id?: string;
  _id?: string;
  firstName: string;
  lastName: string;
}

// Register Turkish locale for the date picker
registerLocale('tr', tr);

// Form initial state
const emptyForm = {
  teacherId: '',
  startDate: new Date(),
  endDate: new Date(new Date().setDate(new Date().getDate() + 7)), // Default 1 week
  reason: 'Yıllık İzin'
};

// Format date for display
const formatDate = (date: Date) => {
  return date.toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Add this function after formatDate function
const calculateLeaveProgress = (startDate: Date | string, endDate: Date | string) => {
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

export default function LeavesPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  
  // Redux state
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { teachers } = useAppSelector((state) => state.teachers) as { teachers: TeacherData[] };
  
  // We'll add the leaves slice to Redux later
  const leaves = useAppSelector((state) => state.leaves?.leaves || []) as LeaveData[];
  const isLoading = useAppSelector((state) => state.leaves?.isLoading || false);
  const error = useAppSelector((state) => state.leaves?.error || null);
  
  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Snackbar state
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
    setTimeout(() => {
      setSnackbar(prev => ({ ...prev, open: false }));
    }, 5000);
  };

  // Close snackbar function
  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Admin permission check
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    } else if (!isAuthenticated) {
      router.push('/login');
    } else {
    }
  }, [user, isAuthenticated, router]);

  // Load data
  useEffect(() => {
    if (user && user.role === 'admin' && isAuthenticated) {
      dispatch(fetchLeaves());
      dispatch(fetchTeachers('active'));
    }
  }, [dispatch, user, isAuthenticated]);

  // Handle input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | null,
    field?: string,
    value?: unknown
  ) => {
    if (e) {
      // Regular form elements
      const { name, value: inputValue } = e.target;
      setFormData((prev) => ({ ...prev, [name]: inputValue }));
    } else if (field && value !== undefined) {
      // DatePicker or custom components
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
    
    // Clear error messages
    setFormError(null);
    dispatch(resetLeaveError());
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form validation
    if (!formData.teacherId) {
      setFormError('Xahiş edirik bir müəllim seçin');
      return;
    }
    
    if (!formData.startDate || !formData.endDate) {
      setFormError('Başlangıç və bitiş tarixləri lazımdır');
      return;
    }
    
    if (formData.startDate > formData.endDate) {
      setFormError('Başlangıç tarixi bitiş tarixindən sonra ola bilməz');
      return;
    }
    
    try {
      if (editingId) {
        // Update existing leave
        await dispatch(updateLeave({ 
          id: editingId, 
          leaveData: {
            teacherId: formData.teacherId,
            startDate: formData.startDate,
            endDate: formData.endDate,
            reason: formData.reason
          }
        })).unwrap();
        
        // Reset form on success
        setFormData(emptyForm);
        setShowForm(false);
        setEditingId(null);
        showSnackbar('Mezuniyet məlumatları ugurla yenilendi', 'success');
      } else {
        // Create new leave
        await dispatch(createLeave({
          teacherId: formData.teacherId,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: formData.reason
        })).unwrap();
        
        // Reset form on success
        setFormData(emptyForm);
        setShowForm(false);
        showSnackbar('Yeni mezuniyet məlumatları ugurla əlavə edildi', 'success');
      }
    } catch (err) {
      console.error('Mezuniyet əməliyyatı baş verdi:', err);
    }
  };

  // Handle edit
  const handleEdit = (leave: LeaveData) => {
    
    setFormData({
      teacherId: leave.teacherId,
      startDate: new Date(leave.startDate),
      endDate: new Date(leave.endDate),
      reason: leave.reason
    });
    
    // Make sure we have a valid ID and use type assertion to handle potential undefined
    const leaveId = (leave.id || leave._id) as string;
    setEditingId(leaveId);
    setShowForm(true);
    setFormError(null);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (confirm('Bu mezuniyet kaydını silmek istediğinize emin misiniz?')) {
      try {
        await dispatch(deleteLeave(id)).unwrap();
        showSnackbar('Mezuniyet məlumatları ugurla silindi', 'delete');
      } catch (err: unknown) {
        console.error('Mezuniyet silme əməliyyatı baş verdi:', err);
        showSnackbar('Silme işlemi başarısız oldu', 'error');
      }
    }
  };

  // Filter leaves based on search term
  const filteredLeaves = leaves.filter((leave: LeaveData) => {
    const teacher = teachers.find(t => t.id === leave.teacherId || t._id === leave.teacherId);
    if (!teacher) return false;
    
    const teacherName = `${teacher.firstName} ${teacher.lastName}`;
    return teacherName.toLowerCase().includes(searchTerm.toLowerCase());
  });
  
  // Get teacher name by ID
  const getTeacherName = (teacherId: string) => {
    const teacher = teachers.find(t => t.id === teacherId || t._id === teacherId);
        return teacher ? `${teacher.firstName} ${teacher.lastName}` : 'Bilinməyən Müəllim';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mezuniyet İdarəetməsi</h1>
          <p className="text-gray-600">Müəllimlərin mezuniyet məlumatlarını idarə edin</p>
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
          <span>Mezuniyet əlavə et</span>
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Add/Edit Leave Form */}
      {showForm && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            {editingId ? 'Mezuniyet məlumatlarını düzenle' : 'Yeni mezuniyet məlumatları əlavə et'}
          </h2>
          
          {formError && (
            <div className="mb-4 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-800">
              <p>{formError}</p>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="teacherId" className="block text-sm font-medium text-gray-700">
                  Müəllim <span className="text-xs text-gray-500">(Sadəcə aktif müəllimlər)</span>
                </label>
                <select
                  id="teacherId"
                  name="teacherId"
                  value={formData.teacherId}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="">Müəllim seçin</option>
                  {teachers?.map((teacher) => (
                    <option 
                      key={teacher.id || teacher._id} 
                      value={teacher.id || teacher._id}
                    >
                      {teacher.firstName} {teacher.lastName}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                    Başlangıç Tarixi
                  </label>
                  <DatePicker
                    id="startDate"
                    selected={formData.startDate}
                    onChange={(date) => handleChange(null, 'startDate', date)}
                    locale="tr"
                    dateFormat="dd MMMM yyyy"
                    className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>
                
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                    Bitiş Tarixi
                  </label>
                  <DatePicker
                    id="endDate"
                    selected={formData.endDate}
                    onChange={(date) => handleChange(null, 'endDate', date)}
                    locale="tr"
                    dateFormat="dd MMMM yyyy"
                    className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                  Mezuniyet Səbəbi
                </label>
                <select
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="Yıllık İzin">İllik İcazə</option>
                  <option value="Sağlık">Sağlık</option>
                  <option value="Özel Durum">Özel Durum</option>
                  <option value="Resmi Tatil">Resmi Tatil</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                disabled={isLoading}
              >
                Ləğv et
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

      {/* Search Box */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="w-5 h-5 text-gray-500" />
        </div>
        <input
          type="text"
          className="block w-full text-black rounded-lg border border-gray-300 bg-white p-2.5 pl-10 text-gray-800 focus:border-blue-500 focus:ring-blue-500"
          placeholder="Müəllim adı axtar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Leaves List */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader size={30} className="animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Veriler yükleniyor...</span>
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {searchTerm ? 'Arama kriterlərinə uyğun mezuniyet məlumatları tapılmadı.' : 'Henüz mezuniyet məlumatları əlavə edilməmiş.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-800">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3">
                    Müəllim
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Başlangıç Tarixi
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Bitiş Tarixi
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Səbəb
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Durum
                  </th>
                  <th scope="col" className="px-6 py-3">
                    <span className="sr-only">İşlemler</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((leave: LeaveData) => {
                  const isActive = new Date(leave.endDate) >= new Date();
                  const isUpcoming = new Date(leave.startDate) > new Date();
                  const progressPercentage = calculateLeaveProgress(leave.startDate, leave.endDate);
                  
                  return (
                    <tr key={leave.id || leave._id} className="border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <div className="flex items-center">
                          <User className="h-5 w-5 text-blue-500 mr-2" />
                          {getTeacherName(leave.teacherId)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {formatDate(new Date(leave.startDate))}
                      </td>
                      <td className="px-6 py-4 text-gray-700">
                        {formatDate(new Date(leave.endDate))}
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
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                              Geçmiş
                            </span>
                          )}
                          
                          <div className="w-full h-2 bg-gray-200 rounded-full mt-1">
                            <div 
                              className={`h-2 rounded-full ${
                                isUpcoming ? 'bg-blue-500' : 
                                isActive ? 'bg-green-500' : 
                                'bg-gray-500'
                              }`}
                              style={{ width: `${progressPercentage}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">{progressPercentage}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(leave)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Düzenle"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(leave.id || leave._id as string)}
                            className="text-red-600 hover:text-red-800"
                            title="Sil"
                          >
                            <Trash size={18} />
                          </button>
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