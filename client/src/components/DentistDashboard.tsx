import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Container,
  Grid,
  Card,
  CardContent,
  Button,
  IconButton,
  Badge
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as OrdersIcon,
  RequestQuote as QuotesIcon,
  Chat as ChatIcon,
  Logout as LogoutIcon,
  Notifications as NotificationsIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const DentistDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingQuotes: 0,
    inProduction: 0,
    delivered: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/orders/stats/overview');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'orders', label: 'My Orders', icon: <OrdersIcon /> },
    { id: 'quotes', label: 'Quotes', icon: <QuotesIcon /> },
    { id: 'chat', label: 'Messages', icon: <ChatIcon /> }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Box>
            <Typography variant="h4" gutterBottom>
              Welcome, Dr. {user?.lastName}
            </Typography>
            
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Orders
                    </Typography>
                    <Typography variant="h4">
                      {stats.totalOrders}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Pending Quotes
                    </Typography>
                    <Typography variant="h4">
                      {stats.pendingQuotes}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      In Production
                    </Typography>
                    <Typography variant="h4">
                      {stats.inProduction}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Delivered
                    </Typography>
                    <Typography variant="h4">
                      {stats.delivered}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Recent Orders
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setActiveTab('orders')}
                  >
                    New Order
                  </Button>
                </Box>
                <Typography color="textSecondary">
                  No recent orders. Create your first order to get started.
                </Typography>
              </CardContent>
            </Card>
          </Box>
        );
      case 'orders':
        return (
          <Box>
            <Typography variant="h4" gutterBottom>
              My Orders
            </Typography>
            <Typography color="textSecondary">
              Order management functionality will be implemented here.
            </Typography>
          </Box>
        );
      case 'quotes':
        return (
          <Box>
            <Typography variant="h4" gutterBottom>
              Quotes
            </Typography>
            <Typography color="textSecondary">
              Quote management functionality will be implemented here.
            </Typography>
          </Box>
        );
      case 'chat':
        return (
          <Box>
            <Typography variant="h4" gutterBottom>
              Messages
            </Typography>
            <Typography color="textSecondary">
              Chat functionality will be implemented here.
            </Typography>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - 240px)`,
          ml: `240px`,
        }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Paradigm Laboratory - Dentist Portal
          </Typography>
          <IconButton color="inherit">
            <Badge badgeContent={2} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: 240,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar>
          <Typography variant="h6" noWrap>
            Dentist Portal
          </Typography>
        </Toolbar>
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.id}
              selected={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          width: `calc(100% - 240px)`,
        }}
      >
        <Toolbar />
        {renderContent()}
      </Box>
    </Box>
  );
};

export default DentistDashboard;