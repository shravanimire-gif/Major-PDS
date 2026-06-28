const Dashboard = () => {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-white mb-2">Welcome</h2>
          <p className="text-gray-400">Manage your PDS system from here</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
