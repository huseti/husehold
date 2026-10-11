import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { voucherService } from '../services/api';
import Navbar from '../components/Navbar';
import VoucherCard from '../components/VoucherCard';
import VoucherFormModal from '../components/VoucherFormModal';

export default function Vouchers() {
  const { t } = useTranslation();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadVouchers();
  }, []);

  const loadVouchers = async () => {
    try {
      const response = await voucherService.getAll();
      setVouchers(response.data.results || []);
    } catch (error) {
      console.error('Error loading vouchers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Errors propagate to the modal, which shows them and stays open.
  const handleAdd = async (data) => {
    await voucherService.create(data);
    setShowAddModal(false);
    loadVouchers();
  };

  const handleRedeem = async (id, amount) => {
    try {
      await voucherService.redeem(id, amount);
      loadVouchers();
    } catch (error) {
      console.error('Error redeeming voucher:', error);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await voucherService.update(id, data);
      loadVouchers();
    } catch (error) {
      console.error('Error updating voucher:', error);
    }
  };

  const handleToggleArchive = async (id) => {
    try {
      await voucherService.toggleArchived(id);
      loadVouchers();
    } catch (error) {
      console.error('Error archiving voucher:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await voucherService.delete(id);
      loadVouchers();
    } catch (error) {
      console.error('Error deleting voucher:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">{t('common.loading')}</div>;
  }

  // Soonest-expiring first; vouchers with no expiry sort to the end.
  const byExpiry = (a, b) => {
    if (!a.valid_until && !b.valid_until) return 0;
    if (!a.valid_until) return 1;
    if (!b.valid_until) return -1;
    return a.valid_until.localeCompare(b.valid_until);
  };

  const active = vouchers.filter((v) => !v.is_archived).sort(byExpiry);
  const archived = vouchers.filter((v) => v.is_archived).sort(byExpiry);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <h2 className="text-3xl font-bold">{t('vouchers.title')}</h2>
          <button onClick={() => setShowAddModal(true)} className="btn-primary px-4 py-2 rounded">
            + {t('vouchers.addTitle')}
          </button>
        </div>

        <h3 className="text-xl font-semibold mb-4">{t('vouchers.active')}</h3>
        <div className="space-y-3 mb-8">
          {active.length === 0 && <p className="text-gray-500">{t('vouchers.noActiveVouchers')}</p>}
          {active.map((v) => (
            <VoucherCard key={v.id} voucher={v} onRedeem={handleRedeem} onUpdate={handleUpdate} onToggleArchive={handleToggleArchive} onDelete={handleDelete} />
          ))}
        </div>

        <h3 className="text-xl font-semibold mb-4">{t('vouchers.archived')}</h3>
        <div className="space-y-3">
          {archived.length === 0 && <p className="text-gray-500">{t('vouchers.noArchivedVouchers')}</p>}
          {archived.map((v) => (
            <VoucherCard key={v.id} voucher={v} onRedeem={handleRedeem} onUpdate={handleUpdate} onToggleArchive={handleToggleArchive} onDelete={handleDelete} />
          ))}
        </div>
      </main>
      {showAddModal && <VoucherFormModal onClose={() => setShowAddModal(false)} onSave={handleAdd} />}
    </div>
  );
}
