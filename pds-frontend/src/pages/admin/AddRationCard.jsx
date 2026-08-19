import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import api from '../../api/axios';
import useToast from '../../components/ui/useToast';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import PanelHeader from '../../design/primitives/PanelHeader';

const defaultValues = {
  card_number: '',
  category: 'BPL',
  area_id: '',
  shop_id: '',
  head_name: '',
  head_age: '',
  head_mobile: '',
};

const AddRationCard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const timeoutRef = useRef(null);
  const [areas, setAreas] = useState([]);
  const [shops, setShops] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loadingShops, setLoadingShops] = useState(false);
  const [members, setMembers] = useState([]);
  const [errorBanner, setErrorBanner] = useState('');

  useEffect(() => {
    document.title = 'New Ration Card — PDS Supervision';
  }, []);

  const {
    register,
    control,
    setValue,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues,
  });

  const selectedAreaId = useWatch({
    control,
    name: 'area_id',
  });

  useEffect(() => {
    const fetchAreas = async () => {
      setLoadingAreas(true);
      try {
        const response = await api.get('/api/admin/areas');
        setAreas(response.data?.areas || []);
      } catch (error) {
        setErrorBanner(error.response?.data?.error || 'Failed to load areas');
      } finally {
        setLoadingAreas(false);
      }
    };

    fetchAreas();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchShopsByArea = async () => {
      if (!selectedAreaId) {
        setShops((prev) => (prev.length > 0 ? [] : prev));
        if (getValues('shop_id')) {
          setValue('shop_id', '');
        }
        return;
      }

      setLoadingShops(true);
      if (getValues('shop_id')) {
        setValue('shop_id', '');
      }
      try {
        const response = await api.get('/api/admin/shops', {
          params: { area_id: selectedAreaId },
        });
        setShops(response.data?.shops || response.data?.data || []);
      } catch (error) {
        setErrorBanner(error.response?.data?.error || 'Failed to load shops');
        setShops([]);
      } finally {
        setLoadingShops(false);
      }
    };

    fetchShopsByArea();
  }, [selectedAreaId]);

  const addMember = () => {
    setMembers((prev) => [...prev, { name: '', age: '' }]);
  };

  const removeMember = (index) => {
    setMembers((prev) => prev.filter((_, memberIndex) => memberIndex !== index));
  };

  const updateMember = (index, field, value) => {
    setMembers((prev) =>
      prev.map((member, memberIndex) => (memberIndex === index ? { ...member, [field]: value } : member))
    );
  };

  const onSubmit = async (values) => {
    setErrorBanner('');

    const hasIncompleteMember = members.some((member) => {
      return !member.name.trim() || member.age === '' || member.age === null;
    });
    if (hasIncompleteMember) {
      setErrorBanner('Please fill all member fields');
      return;
    }

    const payload = {
      card_number: values.card_number.trim(),
      category: values.category,
      shop_id: values.shop_id,
      head: {
        name: values.head_name.trim(),
        age: Number(values.head_age),
        mobile: values.head_mobile.trim(),
      },
      members: members.map((member) => ({
        name: member.name.trim(),
        age: Number(member.age),
      })),
    };

    try {
      const response = await api.post('/api/admin/ration-cards', payload);
      const data = response.data || {};
      const wallet = data.wallet || {};

      toast.success(
        `Ration card created! ${data.members_created} members added. Wallet: Rice ${wallet.rice_balance_kg}kg, Wheat ${wallet.wheat_balance_kg}kg`
      );

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        navigate('/admin/ration-cards');
      }, 1500);
    } catch (error) {
      setErrorBanner(error.response?.data?.error || 'Failed to create ration card');
    }
  };

  return (
    <>
      <PanelHeader title="New Ration Card" />
      <div className="mx-auto max-w-4xl">
      <button
        type="button"
        onClick={() => navigate('/admin/ration-cards')}
        className="mb-6 flex items-center gap-2 rounded-sm text-sm text-text-secondary transition hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      {errorBanner && (
        <div className="mb-6 rounded-sm border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text">
          {errorBanner}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card header="Card Info">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Card Number"
              required
              error={errors.card_number}
              {...register('card_number', { required: 'Card number is required' })}
            />
            <Select label="Category" required {...register('category', { required: true })}>
              <option value="APL">APL</option>
              <option value="BPL">BPL</option>
              <option value="AAY">AAY</option>
            </Select>
            <Select
              label="Area"
              required
              disabled={loadingAreas}
              error={errors.area_id}
              {...register('area_id', { required: 'Area is required' })}
            >
              <option value="">{loadingAreas ? 'Loading areas...' : 'Select Area'}</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <Card header="Shop">
          <Select
            label="Shop"
            required
            disabled={!selectedAreaId || loadingShops}
            error={errors.shop_id}
            {...register('shop_id', { required: 'Shop is required' })}
          >
            {!selectedAreaId ? (
              <option value="">Select Area first</option>
            ) : (
              <option value="">{loadingShops ? 'Loading shops...' : 'Select Shop'}</option>
            )}
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_name}
              </option>
            ))}
          </Select>
        </Card>

        <Card header="Family Head">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Name"
              required
              error={errors.head_name}
              {...register('head_name', { required: 'Head name is required' })}
            />
            <Input
              label="Age"
              type="number"
              required
              error={errors.head_age}
              {...register('head_age', {
                required: 'Head age is required',
                min: { value: 18, message: 'Minimum age is 18' },
                max: { value: 100, message: 'Maximum age is 100' },
              })}
            />
            <Input
              label="Mobile"
              type="text"
              placeholder="Mobile number"
              required
              error={errors.head_mobile}
              {...register('head_mobile', { required: 'Head mobile is required' })}
            />
          </div>
        </Card>

        <Card
          header={
            <div className="flex items-center justify-between gap-4">
              <span>Additional Members</span>
              <Button type="button" variant="secondary" size="sm" onClick={addMember}>
                <Plus size={14} />
                Add Member
              </Button>
            </div>
          }
        >
          {members.length === 0 ? (
            <p className="text-sm text-text-secondary">No additional members added.</p>
          ) : (
            <div className="space-y-3">
              {members.map((member, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Input
                    placeholder="Member name"
                    value={member.name}
                    onChange={(event) => updateMember(index, 'name', event.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Age"
                    value={member.age}
                    onChange={(event) => updateMember(index, 'age', event.target.value)}
                    className="w-28"
                  />
                  <button
                    type="button"
                    onClick={() => removeMember(index)}
                    aria-label={`Remove member ${index + 1}`}
                    className="shrink-0 rounded-sm p-2 text-danger-text transition hover:bg-danger-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Button type="submit" variant="primary" disabled={isSubmitting} className="w-full justify-center">
          {isSubmitting ? 'Creating...' : 'Create Ration Card'}
        </Button>
      </form>
      </div>
    </>
  );
};

export default AddRationCard;
