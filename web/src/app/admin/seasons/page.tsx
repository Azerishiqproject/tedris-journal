'use client';

import { useState, useEffect } from 'react';
import { CalendarRange, Edit, Trash, Plus, Search, Loader, CalendarCheck, CalendarX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { 
  fetchSeasons, 
  createSeason, 
  updateSeason, 
  deleteSeason, 
  resetSeasonError,
  toggleSeasonStatus 
} from '@/redux/slices/seasonSlice';

// Form initial state
const emptyForm = {
  name: '',
  description: '',
  startDate: '',
  endDate: '',
};

export default function SeasonsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { seasons, isLoading, error } = useAppSelector((state) => state.seasons);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    seasonId: string;
    seasonName: string;
  }>({
    show: false,
    seasonId: '',
    seasonName: ''
  });
  
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



  // Admin yetkisi kontrolü
  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    } else if (!isAuthenticated) {
      router.push('/login');
    } else {
    }
  }, [user, isAuthenticated, router]);

  // Sezonları yükle
  useEffect(() => {
    if (user && user.role === 'admin' && isAuthenticated) {
      dispatch(fetchSeasons(activeTab));
    }
  }, [dispatch, user, isAuthenticated, activeTab]);

  // Filter seasons based on search term
  const filteredSeasons = seasons.filter(
    (season) =>
      season.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (season.description?.toLowerCase() || '').includes(searchTerm.toLowerCase())
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
      dispatch(resetSeasonError());
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Form doğrulama
    if (!formData.name) {
      setFormError('Xahiş edirik kurs adını daxil edin.');
      return;
    }
    
    try {
      if (editingId) {
        // Update existing season
        await dispatch(updateSeason({ 
          id: editingId, 
          seasonData: formData 
        })).unwrap();
        
        // Güncelleme sonrası sezonları yeniden çek
        await dispatch(fetchSeasons(activeTab));
        
        // Reset form on success
        setFormData(emptyForm);
        setShowForm(false);
        setEditingId(null);
        showSnackbar('Kurs ugurla düzəliş edildi.');
      } else {
        // Add new season
        await dispatch(createSeason(formData)).unwrap();
        
        // Oluşturma sonrası sezonları yeniden çek
        await dispatch(fetchSeasons(activeTab));
        
        // Reset form on success
        setFormData(emptyForm);
        setShowForm(false);
        showSnackbar('Yeni kurs ugurla əlavə edildi.');
      }
    } catch (err) {
      // Error handling is managed by Redux
      console.error('Season operation failed:', err);
      showSnackbar('Kurs prosesi sırasında bir xəta baş verdi.', 'warning');
    }
  };

  // Handle edit
  const handleEdit = (season: typeof seasons[0]) => {
    setFormData({
      name: season.name,
      description: season.description || '',
      startDate: season.startDate ? new Date(season.startDate).toISOString().split('T')[0] : '',
      endDate: season.endDate ? new Date(season.endDate).toISOString().split('T')[0] : '',
    });
    setEditingId(season.id);
    setShowForm(true);
  };

  // Open confirmation dialog
  const openConfirmDialog = (id: string) => {
    const seasonToDelete = seasons.find(season => (season.id === id || season._id === id));
    if (!seasonToDelete) return;
    
    setConfirmDialog({
      show: true,
      seasonId: id,
      seasonName: seasonToDelete.name
    });
  };
  
  // Close confirmation dialog
  const closeConfirmDialog = () => {
    setConfirmDialog({
      show: false,
      seasonId: '',
      seasonName: ''
    });
  };
  
  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await dispatch(deleteSeason(id)).unwrap();
      
      // Silme işlemi sonrası sezonları yeniden çek
      await dispatch(fetchSeasons(activeTab));
      showSnackbar(`"${confirmDialog.seasonName}" kursu və ona aid bütün dərslər silindi.`, 'delete');
      closeConfirmDialog();
    } catch (err: unknown) {
      // Error handling is managed by Redux
      console.error('Failed to delete season:', err);
      
      // Check if season is in use
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      if (errorMessage.includes('Bu kurs programda istifadə olunur')) {
        showSnackbar('Bu kurs programda istifadə olunur və silinə bilməz.', 'warning');
      } else {
        showSnackbar('Kurs silme prosesi sırasında bir xəta baş verdi.', 'warning');
      }
      closeConfirmDialog();
    }
  };

  // Handle sezon status toggle
  const handleToggleStatus = async (id: string, currentStatus: boolean | undefined) => {
    const statusText = currentStatus ? 'pasif' : 'aktif';
    const confirmMessage = `Bu kursu ${statusText} statusa getirmek istədiğinizə əminsiniz?`;
    
    if (confirm(confirmMessage)) {
      try {
        await dispatch(toggleSeasonStatus(id)).unwrap();
        
        // İşlem sonrası sezonları yeniden çek
        await dispatch(fetchSeasons(activeTab));
        showSnackbar(`Kurs statusu ugurla ${statusText} edildi.`, 'success');
      } catch (err) {
        console.error('Kurs statusu dəyişdirmə əməliyyatı baş verdi:', err);
        showSnackbar('Kurs statusu dəyişdirmə əməliyyatı sırasında bir xəta baş verdi.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kurs İdarəetməsi</h1>
          <p className="text-gray-600">Kursları əlavə edin, düzəldin və idarə edin</p>
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
          <span>Kurs Əlavə Et</span>
        </button>
      </div>

      {/* Redux Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Add/Edit Season Form */}
      {showForm && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            {editingId ? 'Düzəliş Et' : 'Yeni Kurs Əlavə Et'}
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
                    Kurs Adı
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                    Başlangıç Tarixi
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>
                
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                    Bitiş Tarixi
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    className="mt-1 block w-full text-black rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                  dispatch(resetSeasonError());
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
            <CalendarCheck size={16} className="mr-2" />
            Aktiv Kurslar
          </button>
          <button
            onClick={() => setActiveTab('inactive')}
            className={`ml-8 inline-flex items-center border-b-2 px-4 py-2 text-sm font-medium ${
              activeTab === 'inactive'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <CalendarX size={16} className="mr-2" />
            Passiv Kurslar
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
          placeholder="Kurs adına görə axtarış..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Seasons List */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader size={30} className="animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Kurslar yükleniyor...</span>
          </div>
        ) : filteredSeasons.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {searchTerm 
              ? 'Axtarış kriteriyalarına uygun kurs tapılmadı.' 
              : activeTab === 'active'
                ? 'Aktiv kurs tapılmadı.'
                : 'Passiv kurs tapılmadı.'
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-800">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3">
                    Kurs Adı
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Tarix Aralığı
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
                {filteredSeasons.map((season) => (
                  <tr 
                    key={season.id || season._id} 
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center">
                        <CalendarRange className="h-5 w-5 text-blue-500 mr-2" />
                        {season.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {season.startDate && season.endDate 
                        ? `${new Date(season.startDate).toLocaleDateString()} - ${new Date(season.endDate).toLocaleDateString()}`
                        : season.startDate
                          ? `${new Date(season.startDate).toLocaleDateString()} - ?`
                          : season.endDate
                            ? `? - ${new Date(season.endDate).toLocaleDateString()}`
                            : '-'
                      }
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {season.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(season)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Düzenle"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(season.id || season._id || '', season.isActive)}
                          title={season.isActive ? 'Passiv et' : 'Aktiv et'}
                          className="relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full"
                        >
                          <span className={`${season.isActive ? 'bg-green-500' : 'bg-red-500'} absolute h-5 w-9 rounded-full transition`} />
                          <span className={`${season.isActive ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition`} />
                        </button>
                        {activeTab === 'inactive' && (
                          <button
                            onClick={() => openConfirmDialog(season.id || season._id || '')}
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

      {/* Delete Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-xl font-bold text-red-600">XƏBƏRDARLIQ!</h3>
            </div>
            
            <div className="mb-6 space-y-3">
              <p className="text-gray-800 font-medium">
                <span className="font-bold">{confirmDialog.seasonName}</span> kursunu silmək istədiyinizə əminsiniz?
              </p>
              
              <div className="rounded-md bg-red-50 p-4 border border-red-200">
                <p className="text-red-700 font-semibold">
                  Bu kursun içərisindəki BÜTÜN DƏRSLƏR də silinəcəkdir!
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Bu əməliyyat geri qaytarıla bilməz.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirmDialog}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                İmtina Et
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDialog.seasonId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Bəli, Silinsin
              </button>
            </div>
          </div>
        </div>
      )}

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