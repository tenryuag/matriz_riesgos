import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Departments from "./Departments";

import AddDepartment from "./AddDepartment";

import AddRisk from "./AddRisk";

import DepartmentRisks from "./DepartmentRisks";

import AllRisks from "./AllRisks";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Departments: Departments,
    
    AddDepartment: AddDepartment,
    
    AddRisk: AddRisk,
    
    DepartmentRisks: DepartmentRisks,
    
    AllRisks: AllRisks,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Departments" element={<Departments />} />
                
                <Route path="/AddDepartment" element={<AddDepartment />} />
                
                <Route path="/AddRisk" element={<AddRisk />} />
                
                <Route path="/DepartmentRisks" element={<DepartmentRisks />} />
                
                <Route path="/AllRisks" element={<AllRisks />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}