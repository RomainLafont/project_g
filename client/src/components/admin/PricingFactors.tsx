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
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import axios from 'axios';

interface PricingFactor {
  id: string;
  name: string;
  factor: number;
  description: string;
  category: string;
  material: string;
  urgency: string;
  isDefault: boolean;
  isActive: boolean;
  supplier: {
    firstName: string;
    lastName: string;
    companyName: string;
  };
  createdAt: string;
}

const PricingFactors: React.FC = () => {
  const [pricingFactors, setPricingFactors] = useState<PricingFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFactor, setEditingFactor] = useState<PricingFactor | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    factor: 1.0,
    description: '',
    category: 'general',
    material: 'general',
    urgency: 'general',
    isDefault: false,
    isActive: true,
    supplierId: ''
  });

  useEffect(() => {
    fetchPricingFactors();
  }, []);

  const fetchPricingFactors = async () => {
    try {
      const response = await axios.get('/api/admin/pricing-factors');
      setPricingFactors(response.data.pricingFactors);
    } catch (error) {
      console.error('Failed to fetch pricing factors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFactor = () => {
    setEditingFactor(null);
    setFormData({
      name: '',
      factor: 1.0,
      description: '',
      category: 'general',
      material: 'general',
      urgency: 'general',
      isDefault: false,
      isActive: true,
      supplierId: ''
    });
    setDialogOpen(true);
  };

  const handleEditFactor = (factor: PricingFactor) => {
    setEditingFactor(factor);
    setFormData({
      name: factor.name,
      factor: factor.factor,
      description: factor.description,
      category: factor.category,
      material: factor.material,
      urgency: factor.urgency,
      isDefault: factor.isDefault,
      isActive: factor.isActive,
      supplierId: ''
    });
    setDialogOpen(true);
  };

  const handleSaveFactor = async () => {
    try {
      if (editingFactor) {
        await axios.put(`/api/admin/pricing-factors/${editingFactor.id}`, formData);
      } else {
        await axios.post('/api/admin/pricing-factors', formData);
      }
      setDialogOpen(false);
      fetchPricingFactors();
    } catch (error) {
      console.error('Failed to save pricing factor:', error);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'general': 'default',
      'crown': 'primary',
      'bridge': 'secondary',
      'implant': 'error',
      'denture': 'warning',
      'veneer': 'info',
      'inlay': 'success',
      'onlay': 'default'
    };
    return colors[category] || 'default';
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Pricing Factors Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateFactor}
        >
          Create Pricing Factor
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Factors
              </Typography>
              <Typography variant="h4">
                {pricingFactors.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Factors
              </Typography>
              <Typography variant="h4">
                {pricingFactors.filter(f => f.isActive).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Default Factors
              </Typography>
              <Typography variant="h4">
                {pricingFactors.filter(f => f.isDefault).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Avg Factor
              </Typography>
              <Typography variant="h4">
                {pricingFactors.length > 0 
                  ? (pricingFactors.reduce((sum, f) => sum + f.factor, 0) / pricingFactors.length).toFixed(2)
                  : '0.00'
                }
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Pricing Factors Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Factor</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Material</TableCell>
                <TableCell>Urgency</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pricingFactors.map((factor) => (
                <TableRow key={factor.id}>
                  <TableCell>
                    <Typography variant="body2">
                      {factor.name}
                    </Typography>
                    {factor.description && (
                      <Typography variant="caption" color="text.secondary">
                        {factor.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="h6" color="primary">
                      {factor.factor}x
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ({(factor.factor * 100 - 100).toFixed(0)}% margin)
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography 
                      sx={{ 
                        px: 1, 
                        py: 0.5, 
                        borderRadius: 1, 
                        bgcolor: getCategoryColor(factor.category) + '.light',
                        color: 'white',
                        fontSize: '0.75rem',
                        display: 'inline-block'
                      }}
                    >
                      {factor.category.toUpperCase()}
                    </Typography>
                  </TableCell>
                  <TableCell>{factor.material}</TableCell>
                  <TableCell>{factor.urgency}</TableCell>
                  <TableCell>
                    {factor.supplier ? (
                      <Typography variant="body2">
                        {factor.supplier.companyName}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Global
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        {factor.isActive ? 'Active' : 'Inactive'}
                      </Typography>
                      {factor.isDefault && (
                        <Typography variant="caption" color="primary">
                          Default
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {new Date(factor.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="small" 
                      variant="outlined"
                      onClick={() => handleEditFactor(factor)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingFactor ? 'Edit Pricing Factor' : 'Create Pricing Factor'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Factor"
                type="number"
                step="0.1"
                min="1.0"
                max="10.0"
                value={formData.factor}
                onChange={(e) => setFormData({ ...formData, factor: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  label="Category"
                >
                  <MenuItem value="general">General</MenuItem>
                  <MenuItem value="crown">Crown</MenuItem>
                  <MenuItem value="bridge">Bridge</MenuItem>
                  <MenuItem value="implant">Implant</MenuItem>
                  <MenuItem value="denture">Denture</MenuItem>
                  <MenuItem value="veneer">Veneer</MenuItem>
                  <MenuItem value="inlay">Inlay</MenuItem>
                  <MenuItem value="onlay">Onlay</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Material</InputLabel>
                <Select
                  value={formData.material}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  label="Material"
                >
                  <MenuItem value="general">General</MenuItem>
                  <MenuItem value="ceramic">Ceramic</MenuItem>
                  <MenuItem value="porcelain">Porcelain</MenuItem>
                  <MenuItem value="metal">Metal</MenuItem>
                  <MenuItem value="zirconia">Zirconia</MenuItem>
                  <MenuItem value="composite">Composite</MenuItem>
                  <MenuItem value="acrylic">Acrylic</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Urgency</InputLabel>
                <Select
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
                  label="Urgency"
                >
                  <MenuItem value="general">General</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  />
                }
                label="Default Factor"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveFactor} variant="contained">
            {editingFactor ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PricingFactors;