import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../../api/axios';
import useToast from '../ui/useToast';
import Modal from '../ui/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';

const defaultValues = { name: '', email: '', mobile: '', password: '', shop_id: '' };

const AddShopkeeperModal = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let isMounted = true;

    const loadUnassignedShops = async () => {
      reset(defaultValues);
      setShops([]);
      setSubmitError('');
      setLoadingShops(true);

      try {
        const response = await api.get('/api/admin/shops?unassigned=true');
        if (!isMounted) return;
        setShops(response.data?.shops || response.data?.data || []);
      } catch (fetchError) {
        if (!isMounted) return;
        setSubmitError(fetchError.response?.data?.error || 'Failed to load available shops.');
      } finally {
        if (isMounted) setLoadingShops(false);
      }
    };

    loadUnassignedShops();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const closeAndReset = () => {
    reset(defaultValues);
    setSubmitError('');
    onClose();
  };

  const onSubmit = async (values) => {
    setSubmitError('');

    try {
      await api.post('/api/admin/shopkeepers', values);
      toast.success('Shopkeeper added successfully!');
      closeAndReset();
      onSuccess();
    } catch (submitException) {
      const data = submitException.response?.data;
      setSubmitError(data?.details?.join(', ') || data?.error || 'Failed to create shopkeeper.');
    }
  };

  const noUnassignedShops = !loadingShops && shops.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeAndReset}
      title="Add Shopkeeper"
      footer={
        <>
          <Button variant="secondary" onClick={closeAndReset}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="add-shopkeeper-form" disabled={isSubmitting || loadingShops}>
            {isSubmitting ? 'Adding...' : 'Add Shopkeeper'}
          </Button>
        </>
      }
    >
      <form id="add-shopkeeper-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {submitError && (
          <div className="rounded-sm border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
            {submitError}
          </div>
        )}

        <Input label="Full Name" required error={errors.name} {...register('name', { required: 'Name is required' })} />
        <Input
          label="Email"
          type="email"
          required
          error={errors.email}
          {...register('email', { required: 'Email is required' })}
        />
        <Input
          label="Mobile"
          placeholder="Mobile number"
          required
          error={errors.mobile}
          {...register('mobile', { required: 'Mobile is required' })}
        />
        <Input
          label="Password"
          type="password"
          required
          error={errors.password}
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 6, message: 'Minimum 6 characters' },
          })}
        />

        <Select
          label="Shop"
          hint="Optional — you can assign a shop later"
          disabled={loadingShops}
          {...register('shop_id')}
        >
          {loadingShops ? (
            <option value="">Loading shops...</option>
          ) : (
            <>
              <option value="">— No shop (assign later) —</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.shop_name} — {shop.area_name}
                </option>
              ))}
            </>
          )}
        </Select>
        {noUnassignedShops && <p className="text-xs text-text-secondary">No unassigned shops yet. You can assign a shop later.</p>}
      </form>
    </Modal>
  );
};

export default AddShopkeeperModal;
