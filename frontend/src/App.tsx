import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Pantry from "./pages/Pantry";
import MealPlanner from "./pages/MealPlanner";
import Meals from "./pages/Meals";
import Grocery from "./pages/Grocery";
import Budget from "./pages/Budget";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pantry" element={<Pantry />} />
            <Route path="/meal-planner" element={<MealPlanner />} />
            <Route path="/meals" element={<Meals />} />
            <Route path="/grocery" element={<Grocery />} />
            <Route path="/budget" element={<Budget />} />
          </Route>
        </Route>

      </Routes>
    </BrowserRouter>
  );
}

export default App;