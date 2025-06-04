const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const OpenAI = require('openai');
const { readData, writeData } = require('../utils/fileStore');
const axios = require('axios');
const archiver = require('archiver');

const PROJECTS_FILE = 'projects';
const IMAGES_FILE = 'images';
const PROMPTS_FILE = 'prompts';
const RESULTS_FILE = 'results';

// Create a new project
const createProject = async (req, res) => {
  try {
    const { name, description, brief } = req.body;
    const userId = req.user.id; // Assuming authenticateToken middleware adds user info

    const newProject = {
      id: uuidv4(),
      name,
      description,
      brief,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Read existing projects, add the new one, write back
    const projects = await readData(PROJECTS_FILE);
    projects.push(newProject);
    await writeData(PROJECTS_FILE, projects);

    console.log(`[createProject] Successfully saved new project ${newProject.id} for user ${userId}.`);
    res.status(201).json(newProject);
  } catch (error) {
    console.error('[createProject] Error:', error);
    res.status(500).json({ message: 'Error creating project' });
  }
};

// Get all projects for a user
const getProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    const userProjects = await readData(PROJECTS_FILE);
    res.json(userProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Error fetching projects' });
  }
};

// Upload and tag reference images
const uploadImages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const tags = JSON.parse(req.body.tags || '[]');
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    // Read images from file
    const allImages = await readData(IMAGES_FILE);
    const uploadedImageMetadata = []; // Track metadata for response

    await Promise.all(files.map(async (file, index) => {
      const imageId = uuidv4();
      const projectUploadsPath = path.join(__dirname, '..', '..', 'uploads', projectId);
      await fs.ensureDir(projectUploadsPath); 
      const imageExtension = path.extname(file.originalname);
      const newFileName = `${imageId}${imageExtension}`;
      const imagePath = path.join(projectUploadsPath, newFileName);
      const imageUrl = `/uploads/${projectId}/${newFileName}`; 

      await fs.move(file.path, imagePath, { overwrite: true });

      const imageMetadata = {
        id: imageId,
        projectId,
        url: imageUrl,
        originalName: file.originalname,
        tags: tags[index] || [], 
        createdAt: new Date().toISOString()
      };

      // Add metadata to the array read from the file
      allImages.push(imageMetadata);
      uploadedImageMetadata.push(imageMetadata); // Keep track for the response
    }));

    // Write the updated array back to file
    await writeData(IMAGES_FILE, allImages);
    console.log(`[uploadImages] Successfully saved metadata for ${uploadedImageMetadata.length} images for project ${projectId}.`);

    res.status(201).json(uploadedImageMetadata);
  } catch (error) {
    console.error('[uploadImages] Error:', error);
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path).catch(err => console.error('Error deleting temp file:', err));
      });
    }
    res.status(500).json({ message: 'Error uploading images' });
  }
};

// Generate prompts using OpenAI
const generatePrompts = async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiKey = req.headers['x-openai-api-key'];

    if (!apiKey) {
      return res.status(400).json({ message: 'OpenAI API key is required' });
    }

    const openai = new OpenAI({
      apiKey: apiKey
    });

    const project = await readData(PROJECTS_FILE).then(projects => projects.find(p => p.id === projectId));
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const projectImages = await readData(IMAGES_FILE).then(images => images.filter(img => img.projectId === projectId));
    
    const prompt = `Based on the following project brief and reference images, generate 5 creative prompts for image generation:

Project Brief: ${project.brief}

Reference Images: ${projectImages.map(img => `\n- Image with tags: ${img.tags.join(', ')}`).join('')}

Generate 5 diverse prompts that capture the essence of the project while incorporating elements from the reference images.`;

    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-4-turbo-preview",
    });

    const generatedContent = completion.choices[0].message.content;
    
    // Process the new prompts from OpenAI response
    const newPrompts = generatedContent
      .split('\n')
      .map(line => line.trim().replace(/^\d+\.?\s*/, '')) // Remove potential numbering
      .filter(line => line)
      .map(line => ({
        id: uuidv4(),
        projectId,
        content: line,
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
    // Read existing prompts BEFORE combining
    const allPrompts = await readData(PROMPTS_FILE); 

    // Combine existing prompts with the newly generated ones
    const updatedPrompts = [...allPrompts, ...newPrompts];
    await writeData(PROMPTS_FILE, updatedPrompts);
    
    console.log(`[generatePrompts] Successfully wrote ${newPrompts.length} new prompts for projectId ${projectId} to ${PROMPTS_FILE}.json. Total prompts: ${updatedPrompts.length}`);

    res.json(newPrompts); // Return only the newly generated prompts
  } catch (error) {
    console.error('[generatePrompts] Error:', error);
    res.status(500).json({ message: 'Error generating prompts' });
  }
};

// Get prompts for a specific project
const getPrompts = async (req, res) => {
  try {
    const { projectId } = req.params;
    const allPrompts = await readData(PROMPTS_FILE);
    // Ensure project exists and belongs to user (optional but recommended for security)
    const projects = await readData(PROJECTS_FILE);
    const userId = req.user.id;
    const project = projects.find(p => p.id === projectId && p.userId === userId);
    if (!project) {
       return res.status(404).json({ message: 'Project not found or access denied' });
    }
    
    const projectPrompts = allPrompts.filter(prompt => prompt.projectId === projectId);
    res.json(projectPrompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ message: 'Error fetching prompts' });
  }
};

// Update a specific prompt (content or favorite status)
const updatePrompt = async (req, res) => {
  try {
    const { projectId, promptId } = req.params;
    const { content, isFavorite } = req.body; // Expect content or isFavorite
    const userId = req.user.id;

    // Optional: Verify the project belongs to the user
    const projects = await readData(PROJECTS_FILE);
    const project = projects.find(p => p.id === projectId && p.userId === userId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const allPrompts = await readData(PROMPTS_FILE);
    let promptUpdated = false;
    const updatedPrompts = allPrompts.map(prompt => {
      if (prompt.id === promptId && prompt.projectId === projectId) {
        promptUpdated = true;
        const updatedPrompt = { ...prompt };
        if (content !== undefined) {
          updatedPrompt.content = content;
        }
        if (isFavorite !== undefined) {
          updatedPrompt.isFavorite = isFavorite;
        }
        updatedPrompt.updatedAt = new Date().toISOString();
        return updatedPrompt;
      }
      return prompt;
    });

    if (!promptUpdated) {
      return res.status(404).json({ message: 'Prompt not found in this project' });
    }

    await writeData(PROMPTS_FILE, updatedPrompts);
    const finalPrompt = updatedPrompts.find(p => p.id === promptId)

    res.json(finalPrompt); // Return the updated prompt
  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ message: 'Error updating prompt' });
  }
};

// Delete a specific prompt
const deletePrompt = async (req, res) => {
  try {
    const { projectId, promptId } = req.params;
    const userId = req.user.id;

    // Optional: Verify the project belongs to the user
    const projects = await readData(PROJECTS_FILE);
    const project = projects.find(p => p.id === projectId && p.userId === userId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const allPrompts = await readData(PROMPTS_FILE);
    const initialLength = allPrompts.length;
    const updatedPrompts = allPrompts.filter(prompt => !(prompt.id === promptId && prompt.projectId === projectId));

    if (updatedPrompts.length === initialLength) {
      return res.status(404).json({ message: 'Prompt not found in this project' });
    }

    await writeData(PROMPTS_FILE, updatedPrompts);

    res.status(204).send(); // No content to send back
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ message: 'Error deleting prompt' });
  }
};

// Delete a project and its associated data
const deleteProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // 1. Verify project ownership and get project data
    let projects = await readData(PROJECTS_FILE);
    const projectIndex = projects.findIndex(p => p.id === projectId && p.userId === userId);

    if (projectIndex === -1) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    // 2. Remove project from projects data
    projects.splice(projectIndex, 1);
    await writeData(PROJECTS_FILE, projects);
    console.log(`[deleteProject] Removed project ${projectId} metadata.`);

    // 3. Remove associated prompts
    let allPrompts = await readData(PROMPTS_FILE);
    const updatedPrompts = allPrompts.filter(prompt => prompt.projectId !== projectId);
    if (updatedPrompts.length < allPrompts.length) {
        await writeData(PROMPTS_FILE, updatedPrompts);
        console.log(`[deleteProject] Removed prompts for project ${projectId}.`);
    }

    // 4. Remove associated image metadata
    let allImages = await readData(IMAGES_FILE);
    const updatedImages = allImages.filter(image => image.projectId !== projectId);
     if (updatedImages.length < allImages.length) {
        await writeData(IMAGES_FILE, updatedImages);
        console.log(`[deleteProject] Removed image metadata for project ${projectId}.`);
    }

    // 5. Delete associated image files directory
    const projectUploadsPath = path.join(__dirname, '..', '..', 'uploads', projectId);
    await fs.remove(projectUploadsPath); // fs-extra remove deletes directory and contents
    console.log(`[deleteProject] Removed image directory ${projectUploadsPath}.`);

    res.status(204).send(); // Success, no content

  } catch (error) {
    console.error(`[deleteProject] Error deleting project ${req.params.projectId}:`, error);
    res.status(500).json({ message: 'Error deleting project' });
  }
};

// Get a single project by ID
const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const projects = await readData(PROJECTS_FILE);
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check ownership
    if (project.userId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(project);
  } catch (error) {
    console.error(`[getProjectById] Error fetching project ${req.params.projectId}:`, error);
    res.status(500).json({ message: 'Error fetching project details' });
  }
};

// Update project core details (name, description, brief)
const updateProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, brief } = req.body;
    const userId = req.user.id;

    let projects = await readData(PROJECTS_FILE);
    let projectUpdated = false;
    const updatedProjects = projects.map(project => {
      if (project.id === projectId && project.userId === userId) {
        projectUpdated = true;
        return {
          ...project,
          name: name !== undefined ? name : project.name,
          description: description !== undefined ? description : project.description,
          brief: brief !== undefined ? brief : project.brief,
          updatedAt: new Date().toISOString()
        };
      }
      return project;
    });

    if (!projectUpdated) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    await writeData(PROJECTS_FILE, updatedProjects);
    const updatedProject = updatedProjects.find(p => p.id === projectId);

    console.log(`[updateProject] Updated project ${projectId}.`);
    res.json(updatedProject);

  } catch (error) {
    console.error(`[updateProject] Error updating project ${req.params.projectId}:`, error);
    res.status(500).json({ message: 'Error updating project' });
  }
};

// Get images for a specific project
const getProjectImages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify project ownership (important for security)
    const projects = await readData(PROJECTS_FILE);
    const project = projects.find(p => p.id === projectId && p.userId === userId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const allImages = await readData(IMAGES_FILE);
    const projectImages = allImages.filter(image => image.projectId === projectId);
    res.json(projectImages);
  } catch (error) {
    console.error(`[getProjectImages] Error fetching images for project ${req.params.projectId}:`, error);
    res.status(500).json({ message: 'Error fetching project images' });
  }
};

// Generate images using OpenAI DALL-E or Astria
const generateImages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { modelId, prompts } = req.body; // Expect modelId and array of prompt strings
    const openaiApiKey = req.headers['x-openai-api-key'];
    const astriaApiKey = req.headers['x-astria-api-key'];
    const userId = req.user.id;

    if (!modelId || !prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ message: 'Model ID and a non-empty array of prompts are required' });
    }

    // Verify project ownership
    const projects = await readData(PROJECTS_FILE);
    const project = projects.find(p => p.id === projectId && p.userId === userId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const allResults = await readData(RESULTS_FILE);
    const generatedResultsMetadata = [];

    // Ensure results directory exists for the project
    const projectResultsPath = path.join(__dirname, '..', '..', 'uploads', projectId, 'results');
    await fs.ensureDir(projectResultsPath);

    console.log(`[generateImages] Starting generation for ${prompts.length} prompts using model ${modelId}...`);

    // Generate image for each prompt sequentially (can be parallelized later if needed)
    for (const promptContent of prompts) {
      try {
        console.log(`[generateImages] Generating for prompt: "${promptContent.substring(0, 50)}..."`);
        
        let imageUrl;
        if (modelId.includes('astria')) {
          // Astria API call
          if (!astriaApiKey) {
            throw new Error('Astria API key is required for Astria models');
          }

          const astriaResponse = await axios.post(
            'https://api.astria.ai/v1/generate',
            {
              prompt: promptContent,
              model: modelId,
              num_images: 1,
              size: '1024x1024'
            },
            {
              headers: {
                'Authorization': `Bearer ${astriaApiKey}`,
                'Content-Type': 'application/json'
              }
            }
          );

          imageUrl = astriaResponse.data.images[0].url;
        } else {
          // OpenAI DALL-E API call
          if (!openaiApiKey) {
            throw new Error('OpenAI API key is required for DALL-E models');
          }

          const openai = new OpenAI({ apiKey: openaiApiKey });
          const response = await openai.images.generate({
            model: modelId.includes('dall-e-3') ? "dall-e-3" : "dall-e-2",
            prompt: promptContent,
            n: 1,
            size: modelId.includes('dall-e-3') ? "1024x1024" : "512x512",
            response_format: 'url',
          });

          imageUrl = response.data[0].url;
        }

        console.log(`[generateImages] Received image URL: ${imageUrl}`);

        // Download the image from the URL
        const imageResponse = await axios({ url: imageUrl, responseType: 'stream' });

        // Save the image locally
        const resultId = uuidv4();
        const imageFileName = `${resultId}.png`; // Assume png format
        const localImagePath = path.join(projectResultsPath, imageFileName);
        const writer = fs.createWriteStream(localImagePath);
        
        imageResponse.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        console.log(`[generateImages] Saved image locally to ${localImagePath}`);

        const localUrl = `/uploads/${projectId}/results/${imageFileName}`; // Relative URL for frontend

        // Store metadata
        const resultMetadata = {
          id: resultId,
          projectId,
          prompt: promptContent,
          modelIdUsed: modelId,
          imageUrl: localUrl,
          createdAt: new Date().toISOString(),
        };
        allResults.push(resultMetadata);
        generatedResultsMetadata.push(resultMetadata);

      } catch (generationError) {
         console.error(`[generateImages] Error generating image for prompt "${promptContent.substring(0,50)}...":`, generationError.response?.data || generationError.message);
         generatedResultsMetadata.push({ prompt: promptContent, error: generationError.message || 'Failed to generate' });
      }
    }

    // Save all successful results metadata
    await writeData(RESULTS_FILE, allResults);
    console.log(`[generateImages] Finished generation. Saved metadata for ${generatedResultsMetadata.filter(r => !r.error).length} successful images.`);

    res.status(201).json(generatedResultsMetadata);

  } catch (error) {
    console.error(`[generateImages] General Error for project ${req.params.projectId}:`, error);
    res.status(500).json({ message: 'Error generating images' });
  }
};

// Get generated results for a specific project
const getResults = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Verify project ownership
    const projects = await readData(PROJECTS_FILE);
    const project = projects.find(p => p.id === projectId && p.userId === userId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const allResults = await readData(RESULTS_FILE);
    const projectResults = allResults.filter(result => result.projectId === projectId);
    
    console.log(`[getResults] Found ${projectResults.length} results for project ${projectId}.`);
    res.json(projectResults);

  } catch (error) {
    console.error(`[getResults] Error fetching results for project ${req.params.projectId}:`, error);
    res.status(500).json({ message: 'Error fetching results' });
  }
};

// Update a specific result (e.g., favorite status)
const updateResult = async (req, res) => {
  try {
    const { projectId, resultId } = req.params;
    const { isFavorite } = req.body; // Expect isFavorite status
    const userId = req.user.id;

    // Verify project ownership
    const projects = await readData(PROJECTS_FILE);
    const project = projects.find(p => p.id === projectId && p.userId === userId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    const allResults = await readData(RESULTS_FILE);
    let resultUpdated = false;
    const updatedResults = allResults.map(result => {
      if (result.id === resultId && result.projectId === projectId) {
        resultUpdated = true;
        const updatedResult = { 
            ...result,
            isFavorite: isFavorite // Set the favorite status
         };
        return updatedResult;
      }
      return result;
    });

    if (!resultUpdated) {
      return res.status(404).json({ message: 'Result not found in this project' });
    }

    await writeData(RESULTS_FILE, updatedResults);
    const finalResult = updatedResults.find(r => r.id === resultId);

    console.log(`[updateResult] Updated result ${resultId} for project ${projectId}. Favorite: ${finalResult.isFavorite}`);
    res.json(finalResult); // Return the updated result

  } catch (error) {
    console.error(`[updateResult] Error updating result ${req.params.resultId}:`, error);
    res.status(500).json({ message: 'Error updating result' });
  }
};

// Export all results for a project as a Zip file
const exportProjectResults = async (req, res) => {
  try {
    const { projectId } = req.params;
    // The token might be passed via query for direct download links
    // Or use authenticateToken middleware if preferred (requires fetch/axios on frontend)
    const userId = req.user?.id; // Use optional chaining if middleware isn't guaranteed

    // If not using middleware, manually verify token from query param (less secure)
    // const token = req.query.token;
    // if (!token) return res.status(401).json({ message: 'Token required' });
    // try { 
    //     const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-very-secure-secret-key');
    //     userId = decoded.id;
    // } catch (err) { return res.status(403).json({ message: 'Invalid token' }); }

    // 1. Verify project ownership
    const projects = await readData(PROJECTS_FILE);
    const project = projects.find(p => p.id === projectId && p.userId === userId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found or access denied' });
    }

    // 2. Get results metadata for the project
    const allResults = await readData(RESULTS_FILE);
    const projectResults = allResults.filter(result => result.projectId === projectId);

    if (projectResults.length === 0) {
      return res.status(404).json({ message: 'No results found to export for this project' });
    }

    console.log(`[exportResults] Starting export for project ${projectId} (${projectResults.length} results)`);

    // 3. Prepare Zip archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Set compression level
    });

    // Handle archiving errors
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('[exportResults] Archiver warning:', err);
      } else {
        throw err; // Rethrow other warnings as errors
      }
    });
    archive.on('error', (err) => {
        console.error('[exportResults] Archiver error:', err);
        // Cannot set headers after error, but try to signal client if possible
        // Best effort: Ensure response ends if possible.
         if (!res.headersSent) {
            res.status(500).send({ error: 'Failed to create zip file' });
         } else {
            res.end(); // End the stream if headers are already sent
         }
    });

    // Set response headers for zip download
    const zipFileName = `${project.name || projectId}_results.zip`.replace(/[^a-zA-Z0-9_.-]/g, '_'); // Sanitize filename
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

    // Pipe the archive stream to the response
    archive.pipe(res);

    // 4. Add files to the archive
    const resultsDir = path.join(__dirname, '..', '..', 'uploads', projectId, 'results');
    for (const result of projectResults) {
        const imageFileName = path.basename(result.imageUrl); // e.g., uuid.png
        const filePath = path.join(resultsDir, imageFileName);
        // Check if file exists before trying to append
        if (await fs.pathExists(filePath)) {
            // Use prompt (sanitized) or ID as filename within zip
            const sanitizedPrompt = result.prompt.substring(0, 50).replace(/[^a-zA-Z0-9_.-]/g, '_');
            const nameInZip = `${result.id}_${sanitizedPrompt}.png`;
            archive.file(filePath, { name: nameInZip });
        } else {
             console.warn(`[exportResults] File not found, skipping: ${filePath}`);
        }
    }

    // 5. Finalize the archive (signals no more files will be added)
    await archive.finalize();
    console.log(`[exportResults] Finalized archive for project ${projectId}. Total bytes: ${archive.pointer()}`);

  } catch (error) {
    console.error(`[exportResults] Error exporting project ${req.params.projectId}:`, error);
     if (!res.headersSent) {
        res.status(500).json({ message: 'Error exporting project results' });
     }
  }
};

module.exports = {
  createProject,
  getProjects,
  uploadImages,
  generatePrompts,
  getPrompts,
  updatePrompt,
  deletePrompt,
  deleteProject,
  getProjectById,
  updateProject,
  getProjectImages,
  generateImages,
  getResults,
  updateResult,
  exportProjectResults
}; 