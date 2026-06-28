import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const inputClassName =
  'bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white w-full text-sm focus:outline-none focus:border-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed';

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
  const timeoutRef = useRef(null);
  const [areas, setAreas] = useState([]);
  const [shops, setShops] = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loadingShops, setLoadingShops] = useState(false);
  const [members, setMembers] = useState([]);
  const [successBanner, setSuccessBanner] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

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
      prev.map((member, memberIndex) =>
        memberIndex === index ? { ...member, [field]: value } : member
      )
    );
  };

  const onSubmit = async (values) => {
    setErrorBanner('');
    setSuccessBanner('');

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

      setSuccessBanner(
        `✓ Ration card created! ${data.members_created} members added. Wallet: Rice ${wallet.rice_balance_kg}kg, Wheat ${wallet.wheat_balance_kg}kg, Sugar ${wallet.sugar_balance_kg}kg`
      );

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        navigate('/admin/ration-cards');
      }, 3000);
    } catch (error) {
      setErrorBanner(error.response?.data?.error || 'Failed to create ration card');
    }
  };

  return (
    <div className="p-8 bg-gray-950 min-h-screen text-white max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate('/admin/ration-cards')}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition"
      >
        <span>←</span>
        <span>Back</span>
      </button>

      <h1 className="text-2xl font-bold mb-6">Add Ration Card</h1>

      {successBanner && (
        <div className="bg-green-900/40 border border-green-700 rounded-xl p-4 text-green-300 text-sm mb-6">
          {successBanner}
        </div>
      )}

      {errorBanner && (
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-4 text-red-300 text-sm mb-6">
          {errorBanner}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <section className="bg-gray-900 rounded-2xl p-6 mb-4 border border-gray-800">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Card Info
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Card Number</label>
              <input
                type="text"
                className={inputClassName}
                {...register('card_number', { required: 'Card number is required' })}
              />
              {errors.card_number && (
                <p className="text-red-400 text-xs mt-1">{errors.card_number.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Category</label>
              <select className={inputClassName} {...register('category', { required: true })}>
                <option value="APL">APL</option>
                <option value="BPL">BPL</option>
                <option value="AAY">AAY</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Area</label>
              <select
                className={inputClassName}
                disabled={loadingAreas}
                {...register('area_id', { required: 'Area is required' })}
              >
                <option value="">{loadingAreas ? 'Loading areas...' : 'Select Area'}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
              {errors.area_id && <p className="text-red-400 text-xs mt-1">{errors.area_id.message}</p>}
            </div>
          </div>
        </section>

        <section className="bg-gray-900 rounded-2xl p-6 mb-4 border border-gray-800">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Shop
          </h2>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Shop</label>
            <select
              className={inputClassName}
              disabled={!selectedAreaId || loadingShops}
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
            </select>
            {errors.shop_id && <p className="text-red-400 text-xs mt-1">{errors.shop_id.message}</p>}
          </div>
        </section>

        <section className="bg-gray-900 rounded-2xl p-6 mb-4 border border-gray-800">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Family Head
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Name</label>
              <input
                type="text"
                className={inputClassName}
                {...register('head_name', { required: 'Head name is required' })}
              />
              {errors.head_name && (
                <p className="text-red-400 text-xs mt-1">{errors.head_name.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Age</label>
              <input
                type="number"
                className={inputClassName}
                {...register('head_age', {
                  required: 'Head age is required',
                  min: { value: 18, message: 'Minimum age is 18' },
                  max: { value: 100, message: 'Maximum age is 100' },
                })}
              />
              {errors.head_age && (
                <p className="text-red-400 text-xs mt-1">{errors.head_age.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Mobile</label>
              <input
                type="text"
                placeholder="Mobile number"
                className={inputClassName}
                {...register('head_mobile', { required: 'Head mobile is required' })}
              />
              {errors.head_mobile && (
                <p className="text-red-400 text-xs mt-1">{errors.head_mobile.message}</p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-gray-900 rounded-2xl p-6 mb-4 border border-gray-800">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Additional Members
            </h2>
            <button
              type="button"
              onClick={addMember}
              className="border border-dashed border-gray-600 text-gray-400 text-sm hover:border-blue-500 hover:text-blue-400 rounded-lg px-4 py-2 transition w-auto"
            >
              Add Member
            </button>
          </div>

          {members.map((member, index) => (
            <div key={index} className="flex gap-3 items-center mb-3">
              <input
                type="text"
                placeholder="Member name"
                className={inputClassName}
                value={member.name}
                onChange={(event) => updateMember(index, 'name', event.target.value)}
              />
              <input
                type="number"
                min="0"
                max="100"
                placeholder="Age"
                className={inputClassName}
                value={member.age}
                onChange={(event) => updateMember(index, 'age', event.target.value)}
              />
              <button
                type="button"
                onClick={() => removeMember(index)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                Remove ✕
              </button>
            </div>
          ))}
        </section>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 hover:bg-blue-700 rounded-lg px-6 py-3 w-full font-medium transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isSubmitting ? 'Creating...' : 'Create Ration Card'}
        </button>
      </form>
    </div>
  );
};

export default AddRationCard;
