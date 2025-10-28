import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Edit as EditIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';
import axios from 'axios';

interface Order {
  id: string;
  orderNumber: string;
  title: string;
  status: string;
  patientName: string;
  prosthesisType: string;
  material: string;
  urgency: string;
  createdAt: string;
  dentist: {
    firstName: string;
    lastName: string;
    practiceName: string;
  };
  supplier: {
    firstName: string;
    lastName: string;
    companyName: string;
  };
  quotes: any[];
}

const OrdersManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get('/api/admin/orders');
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'quote_asked': 'warning',
      'quote_sent': 'info',
      'quote_validated': 'success',
      'in_production': 'primary',
      'in_shipping': 'secondary',
      'delivered': 'success',
      'cancelled': 'error'
    };
    return colors[status] || 'default';
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setViewDialogOpen(true);
  };

  const handleAssignSupplier = (order: Order) => {
    // TODO: Implement supplier assignment dialog
    console.log('Assign supplier to order:', order.id);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Orders Management
      </Typography>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Search orders"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, order number, or patient name"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="quote_asked">Quote Asked</MenuItem>
                <MenuItem value="quote_sent">Quote Sent</MenuItem>
                <MenuItem value="quote_validated">Quote Validated</MenuItem>
                <MenuItem value="in_production">In Production</MenuItem>
                <MenuItem value="in_shipping">In Shipping</MenuItem>
                <MenuItem value="delivered">Delivered</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              onClick={fetchOrders}
              fullWidth
            >
              Refresh
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Orders Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order #</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Patient</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Dentist</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{order.title}</TableCell>
                  <TableCell>{order.patientName || 'N/A'}</TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{order.prosthesisType}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.material}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {order.dentist.firstName} {order.dentist.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.dentist.practiceName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {order.supplier.firstName} {order.supplier.lastName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.supplier.companyName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={order.status.replace('_', ' ').toUpperCase()}
                      color={getStatusColor(order.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleViewOrder(order)}
                      title="View Details"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleAssignSupplier(order)}
                      title="Assign Supplier"
                    >
                      <AssignmentIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Order Details Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Order Details - {selectedOrder?.orderNumber}
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Order Information
                  </Typography>
                  <Typography><strong>Title:</strong> {selectedOrder.title}</Typography>
                  <Typography><strong>Status:</strong> {selectedOrder.status}</Typography>
                  <Typography><strong>Patient:</strong> {selectedOrder.patientName}</Typography>
                  <Typography><strong>Type:</strong> {selectedOrder.prosthesisType}</Typography>
                  <Typography><strong>Material:</strong> {selectedOrder.material}</Typography>
                  <Typography><strong>Urgency:</strong> {selectedOrder.urgency}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="h6" gutterBottom>
                    Participants
                  </Typography>
                  <Typography><strong>Dentist:</strong> {selectedOrder.dentist.firstName} {selectedOrder.dentist.lastName}</Typography>
                  <Typography><strong>Practice:</strong> {selectedOrder.dentist.practiceName}</Typography>
                  <Typography><strong>Supplier:</strong> {selectedOrder.supplier.firstName} {selectedOrder.supplier.lastName}</Typography>
                  <Typography><strong>Company:</strong> {selectedOrder.supplier.companyName}</Typography>
                </Grid>
              </Grid>
              
              {selectedOrder.quotes && selectedOrder.quotes.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Quotes ({selectedOrder.quotes.length})
                  </Typography>
                  {selectedOrder.quotes.map((quote, index) => (
                    <Paper key={quote.id} sx={{ p: 2, mb: 1 }}>
                      <Typography><strong>Quote #{index + 1}</strong></Typography>
                      <Typography>Total Price: €{quote.totalPrice}</Typography>
                      <Typography>Adjusted Price: €{quote.adjustedPrice}</Typography>
                      <Typography>Status: {quote.status}</Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersManagement;